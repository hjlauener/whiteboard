<?php

declare(strict_types=1);

use Psr\Http\Message\ServerRequestInterface;

/**
 * GUI class of the Udon Whiteboard repository object.
 *
 * The board itself is a TypeScript application (Excalidraw, see frontend/),
 * built into js/dist/. It talks to this class via the command "syncBoard"
 * (polling, JSON): own changes are sent, changes of the others and the
 * pointers of the people on the board come back.
 *
 * Permissions (ILIAS RBAC):
 * - visible: the board appears in the course/category
 * - read:    open and view the board (with the pointers of the others)
 * - udw_edit ("Board bearbeiten"): draw and edit objects on the board
 * - write:   settings (title, description), includes editing the board
 * Anonymous users can only view. The server checks the permission for every
 * change; without it the board opens in view mode.
 *
 * @ilCtrl_isCalledBy ilObjUdonWhiteboardGUI: ilRepositoryGUI, ilAdministrationGUI, ilObjPluginDispatchGUI
 * @ilCtrl_Calls      ilObjUdonWhiteboardGUI: ilPermissionGUI, ilInfoScreenGUI, ilObjectCopyGUI, ilCommonActionDispatcherGUI
 */
class ilObjUdonWhiteboardGUI extends ilObjectPluginGUI
{
    private const TAB_CONTENT = 'content';
    private const TAB_PROPERTIES = 'properties';

    /** commands that need the permission "write" */
    private const WRITE_COMMANDS = ['editProperties', 'updateProperties'];
    /** commands that need the permission "read" */
    private const READ_COMMANDS = ['showContent', 'syncBoard'];

    /** poll interval of the board in milliseconds */
    private const POLL_INTERVAL = 1000;
    /** limits for one sync request */
    private const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
    private const MAX_ELEMENTS = 500;
    private const MAX_ELEMENT_BYTES = 1024 * 1024;

    /** element types of Excalidraw that may be stored */
    private const ELEMENT_TYPES = [
        'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'frame', 'embeddable',
    ];

    private ilUdwRepository $xudw_repo;
    private ilObjUser $xudw_user;
    private ServerRequestInterface $xudw_request;

    protected function afterConstructor(): void
    {
        global $DIC;

        $this->xudw_repo = new ilUdwRepository($DIC->database());
        $this->xudw_user = $DIC->user();
        $this->xudw_request = $DIC->http()->request();
    }

    final public function getType(): string
    {
        return ilUdonWhiteboardPlugin::ID;
    }

    public function getAfterCreationCmd(): string
    {
        return 'showContent';
    }

    public function getStandardCmd(): string
    {
        return 'showContent';
    }

    public function performCommand(string $cmd): void
    {
        if (in_array($cmd, self::WRITE_COMMANDS, true)) {
            $this->checkPermission('write');
            $this->$cmd();
            return;
        }

        $this->checkPermission('read');
        if (in_array($cmd, self::READ_COMMANDS, true)) {
            $this->$cmd();
            return;
        }
        $this->showContent();
    }

    protected function setTabs(): void
    {
        $ref_id = $this->object->getRefId();

        if ($this->access->checkAccess('read', '', $ref_id)) {
            $this->tabs->addTab(
                self::TAB_CONTENT,
                $this->txt('content'),
                $this->ctrl->getLinkTarget($this, 'showContent')
            );
        }

        $this->addInfoTab();

        if ($this->access->checkAccess('write', '', $ref_id)) {
            $this->tabs->addTab(
                self::TAB_PROPERTIES,
                $this->txt('properties'),
                $this->ctrl->getLinkTarget($this, 'editProperties')
            );
        }

        $this->addPermissionTab();
    }

    // ------------------------------------------------------------------
    // Board
    // ------------------------------------------------------------------

    /**
     * Tab "Inhalt": the board.
     */
    protected function showContent(): void
    {
        $this->tabs->activateTab(self::TAB_CONTENT);

        $dist = $this->getPlugin()->getRelativeDirectory() . '/js/dist/';
        $version = $this->getAssetVersion();

        $this->tpl->addCss($dist . 'whiteboard.css?v=' . $version);

        $config = [
            'syncUrl' => $this->ctrl->getFormAction($this, 'syncBoard', '', true),
            'assetPath' => rtrim(ILIAS_HTTP_PATH, '/') . '/' . $dist,
            'langCode' => $this->getExcalidrawLanguage(),
            'userId' => $this->xudw_user->getId(),
            'canEdit' => $this->canEdit(),
            'pollInterval' => self::POLL_INTERVAL,
            'texts' => [
                'offline' => $this->txt('status_offline'),
                'saving' => $this->txt('status_saving'),
                'saved' => $this->txt('status_saved'),
                'viewOnly' => $this->txt('status_view_only'),
            ],
        ];

        $html = '<div class="xudw-board" data-config="'
            . htmlspecialchars((string) json_encode($config), ENT_QUOTES)
            . '"></div>'
            . '<script type="module" src="'
            . htmlspecialchars($dist . 'whiteboard.js?v=' . $version, ENT_QUOTES)
            . '"></script>';

        $this->tpl->setContent($html);
    }

    /**
     * Polling endpoint of the board (POST, JSON).
     *
     * Request:  {since: int, elements: [...], pointer: {x, y} | null}
     * Response: {rev: int, elements: [...], users: [{id, name, pointer}]}
     */
    protected function syncBoard(): void
    {
        $raw = (string) $this->xudw_request->getBody();
        if (strlen($raw) > self::MAX_REQUEST_BYTES) {
            $this->sendJsonString((string) json_encode(['error' => 'request too large']));
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            $data = [];
        }

        $board_id = $this->object->getId();
        $user_id = $this->xudw_user->getId();
        $since = is_int($data['since'] ?? null) ? max(0, $data['since']) : 0;

        if ($this->canEdit() && is_array($data['elements'] ?? null)) {
            $elements = [];
            foreach (array_slice($data['elements'], 0, self::MAX_ELEMENTS) as $element) {
                $clean = is_array($element) ? $this->cleanElement($element) : null;
                if ($clean !== null) {
                    $elements[] = $clean;
                }
            }
            $this->xudw_repo->saveElements($board_id, $elements, $user_id);
        }

        if (!$this->isAnonymous()) {
            [$x, $y] = $this->readPointer($data['pointer'] ?? null);
            $this->xudw_repo->touchPresence($board_id, $user_id, $x, $y);
        }

        $changes = $this->xudw_repo->getChanges($board_id, $since);

        $users = [];
        foreach ($this->xudw_repo->getPresentUsers($board_id) as $user) {
            $users[] = [
                'id' => $user['id'],
                'name' => ilObjUser::_lookupFullname($user['id']),
                'pointer' => $user['x'] === null || $user['y'] === null ? null : ['x' => $user['x'], 'y' => $user['y']],
            ];
        }

        // the elements are stored as JSON already
        $this->sendJsonString(
            '{"rev":' . $changes['rev']
            . ',"elements":[' . implode(',', $changes['elements']) . ']'
            . ',"users":' . json_encode($users, JSON_UNESCAPED_UNICODE) . '}'
        );
    }

    /**
     * Checks an element sent by the board.
     *
     * @param array<mixed> $element
     * @return array{id: string, version: int, nonce: int, deleted: bool, json: string}|null
     */
    private function cleanElement(array $element): ?array
    {
        $id = $element['id'] ?? null;
        $version = $element['version'] ?? null;
        $nonce = $element['versionNonce'] ?? 0;
        $type = $element['type'] ?? null;

        if (!is_string($id) || preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id) !== 1
            || !is_int($version) || $version < 1
            || !is_int($nonce)
            || !is_string($type) || !in_array($type, self::ELEMENT_TYPES, true)) {
            return null;
        }

        $json = json_encode($element, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || strlen($json) > self::MAX_ELEMENT_BYTES) {
            return null;
        }

        return [
            'id' => $id,
            'version' => $version,
            'nonce' => $nonce,
            'deleted' => ($element['isDeleted'] ?? false) === true,
            'json' => $json,
        ];
    }

    /**
     * @return array{0: ?float, 1: ?float}
     */
    private function readPointer(mixed $pointer): array
    {
        if (!is_array($pointer)) {
            return [null, null];
        }
        $x = $pointer['x'] ?? null;
        $y = $pointer['y'] ?? null;
        if (!is_int($x) && !is_float($x) || !is_int($y) && !is_float($y)) {
            return [null, null];
        }
        return [(float) $x, (float) $y];
    }

    /**
     * Draw and edit objects: permission "Board bearbeiten" or "write".
     */
    private function canEdit(): bool
    {
        if ($this->isAnonymous()) {
            return false;
        }
        $ref_id = $this->object->getRefId();
        return $this->access->checkAccess(ilUdonWhiteboardPlugin::OP_EDIT, '', $ref_id)
            || $this->access->checkAccess('write', '', $ref_id);
    }

    private function isAnonymous(): bool
    {
        return $this->xudw_user->getId() === ANONYMOUS_USER_ID || $this->xudw_user->getId() === 0;
    }

    /**
     * Language of the board (Excalidraw has its own translations).
     */
    private function getExcalidrawLanguage(): string
    {
        return match ($this->lng->getLangKey()) {
            'de' => 'de-DE',
            'fr' => 'fr-FR',
            default => 'en',
        };
    }

    /**
     * Version parameter for the board files, so that browsers load a new
     * build instead of an old one from their cache.
     */
    private function getAssetVersion(): string
    {
        $file = $this->getPlugin()->getDirectory() . '/js/dist/whiteboard.js';
        return is_file($file) ? (string) filemtime($file) : '0';
    }

    /**
     * @return never
     */
    private function sendJsonString(string $json): void
    {
        global $DIC;
        $http = $DIC->http();
        $http->saveResponse(
            $http->response()
                ->withHeader('Content-Type', 'application/json; charset=utf-8')
                ->withHeader('Cache-Control', 'no-store')
                ->withBody(\ILIAS\Filesystem\Stream\Streams::ofString($json))
        );
        $http->sendResponse();
        $http->close();
    }

    // ------------------------------------------------------------------
    // Settings of the repository object
    // ------------------------------------------------------------------

    protected function editProperties(?ilPropertyFormGUI $form = null): void
    {
        $this->tabs->activateTab(self::TAB_PROPERTIES);

        if ($form === null) {
            $form = $this->initPropertiesForm();
            $form->setValuesByArray([
                'title' => $this->object->getTitle(),
                'desc' => $this->object->getLongDescription(),
            ]);
        }

        $this->tpl->setContent($form->getHTML());
    }

    protected function updateProperties(): void
    {
        $form = $this->initPropertiesForm();
        if (!$form->checkInput()) {
            $form->setValuesByPost();
            $this->editProperties($form);
            return;
        }

        $this->object->setTitle((string) $form->getInput('title'));
        $this->object->setDescription((string) $form->getInput('desc'));
        $this->object->update();

        $this->tpl->setOnScreenMessage('success', $this->lng->txt('msg_obj_modified'), true);
        $this->ctrl->redirect($this, 'editProperties');
    }

    private function initPropertiesForm(): ilPropertyFormGUI
    {
        $form = new ilPropertyFormGUI();
        $form->setTitle($this->txt('properties'));
        $form->setFormAction($this->ctrl->getFormAction($this, 'updateProperties'));

        $title = new ilTextInputGUI($this->lng->txt('title'), 'title');
        $title->setRequired(true);
        $title->setMaxLength(ilObject::TITLE_LENGTH);
        $form->addItem($title);

        $desc = new ilTextAreaInputGUI($this->lng->txt('description'), 'desc');
        $desc->setRows(2);
        $form->addItem($desc);

        $form->addCommandButton('updateProperties', $this->lng->txt('save'));

        return $form;
    }
}
