<?php

declare(strict_types=1);

/**
 * GUI class of the Udon Whiteboard repository object.
 *
 * Permissions:
 * - read:  open the whiteboard
 * - write: settings (title, description)
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
    private const READ_COMMANDS = ['showContent'];

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
    // Content
    // ------------------------------------------------------------------

    /**
     * Start page of the whiteboard. The drawing area will be shown here.
     */
    protected function showContent(): void
    {
        $this->tabs->activateTab(self::TAB_CONTENT);
        $this->tpl->setOnScreenMessage('info', $this->txt('whiteboard_empty'));
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
