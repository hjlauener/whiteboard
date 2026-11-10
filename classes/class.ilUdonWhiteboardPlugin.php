<?php

declare(strict_types=1);

/**
 * Repository object plugin "Udon Whiteboard" (type xudw) for ILIAS 11.
 */
class ilUdonWhiteboardPlugin extends ilRepositoryObjectPlugin
{
    public const ID = 'xudw';
    public const NAME = 'UdonWhiteboard';

    /** RBAC operation "Board bearbeiten": draw and edit objects on the board (label from the language file) */
    public const OP_EDIT = 'udw_edit';
    /** RBAC operation "read" (whoever may open a board also gets "edit" once, as before this permission existed) */
    private const OP_ID_READ = 3;
    /** roles that never get "edit" automatically */
    private const ROLE_ID_GUEST = 5;
    private const ROLE_ID_ANONYMOUS = 14;

    /**
     * Default permissions are derived from the ILIAS forum: operation of the
     * forum => operations of the whiteboard.
     */
    private const FORUM_TYPE = 'frm';
    private const FORUM_OPS_TO_BOARD = [
        'edit_permission' => ['edit_permission'],
        'visible' => ['visible'],
        'read' => ['read'],
        'write' => ['write', self::OP_EDIT],
        'delete' => ['delete'],
        'add_thread' => [self::OP_EDIT],
    ];

    public function getPluginName(): string
    {
        return self::NAME;
    }

    /**
     * Icon of the object type. ILIAS always loads it under the same name
     * (icon_xudw.svg), so browsers keep showing an old version from their
     * cache. The modification time as version parameter makes them load the
     * current icon whenever it changes.
     */
    public static function _getIcon(string $a_type): string
    {
        $path = parent::_getIcon($a_type);
        $file = dirname(__DIR__) . '/templates/images/icon_' . $a_type . '.svg';
        if (!is_file($file) || str_contains($path, '?')) {
            return $path;
        }
        return $path . '?v=' . filemtime($file);
    }

    protected function uninstallCustom(): void
    {
        global $DIC;
        $db = $DIC->database();

        foreach (ilUdwRepository::TABLES as $table) {
            if ($db->tableExists($table)) {
                $db->dropTable($table, false);
            }
        }
        ilUdwPalettes::deleteSettings();
        ilUdwTemplates::deleteSettings();
    }

    public function allowCopy(): bool
    {
        return false;
    }

    protected function afterUpdate(): void
    {
        $this->ensureEditPermission();
        $this->ensureDefaultPermissions();
    }

    protected function afterActivation(): void
    {
        $this->ensureEditPermission();
        $this->ensureDefaultPermissions();
    }

    /**
     * Creates the permission "Board bearbeiten" (RBAC operation) and assigns
     * it to the object type. When the permission is new, all roles that may
     * open an Udon Whiteboard (read) get it too – in existing boards and in
     * the role templates –, except guests and anonymous users. So everybody
     * who could draw before can still draw; for a board that may only be
     * viewed, the permission is removed in the permission settings.
     * Safe to call several times.
     */
    private function ensureEditPermission(): void
    {
        $db = $this->db;

        // object type (created by ILIAS on activation)
        $set = $db->query(
            'SELECT obj_id FROM object_data WHERE type = ' . $db->quote('typ', 'text') .
            ' AND title = ' . $db->quote(self::ID, 'text')
        );
        $rec = $db->fetchAssoc($set);
        if ($rec === null) {
            return; // not activated yet: afterActivation() will do it
        }
        $type_id = (int) $rec['obj_id'];

        // operation
        $set = $db->query(
            'SELECT ops_id FROM rbac_operations WHERE operation = ' . $db->quote(self::OP_EDIT, 'text')
        );
        $rec = $db->fetchAssoc($set);
        if ($rec !== null) {
            $ops_id = (int) $rec['ops_id'];
        } else {
            $ops_id = $db->nextId('rbac_operations');
            $db->insert('rbac_operations', [
                'ops_id' => ['integer', $ops_id],
                'operation' => ['text', self::OP_EDIT],
                'description' => ['text', 'Udon Whiteboard: edit board'],
                'class' => ['text', 'object'],
                'op_order' => ['integer', 8600],
            ]);
        }

        // assignment to the object type
        $set = $db->query(
            'SELECT ops_id FROM rbac_ta WHERE typ_id = ' . $db->quote($type_id, 'integer') .
            ' AND ops_id = ' . $db->quote($ops_id, 'integer')
        );
        if ($db->fetchAssoc($set) !== null) {
            return; // already done before
        }
        $db->insert('rbac_ta', [
            'typ_id' => ['integer', $type_id],
            'ops_id' => ['integer', $ops_id],
        ]);

        $this->grantToRolesWithRead($ops_id);
    }

    /**
     * Gives the new operation to every role that has "read" on an Udon
     * Whiteboard (existing objects and role templates), like ILIAS does when
     * it introduces new permissions.
     */
    private function grantToRolesWithRead(int $ops_id): void
    {
        $db = $this->db;
        $excluded = [self::ROLE_ID_GUEST, self::ROLE_ID_ANONYMOUS];

        // existing boards (rbac_pa stores the operations as serialized array)
        $set = $db->query(
            'SELECT rpa.rol_id, rpa.ref_id, rpa.ops_id FROM rbac_pa rpa' .
            ' JOIN object_reference ref ON ref.ref_id = rpa.ref_id' .
            ' JOIN object_data od ON od.obj_id = ref.obj_id AND od.type = ' . $db->quote(self::ID, 'text')
        );
        $rows = [];
        while ($rec = $db->fetchAssoc($set)) {
            $rows[] = $rec;
        }
        foreach ($rows as $rec) {
            if (in_array((int) $rec['rol_id'], $excluded, true)) {
                continue;
            }
            $ops = unserialize((string) $rec['ops_id'], ['allowed_classes' => false]);
            if (!is_array($ops)) {
                continue;
            }
            $ops = array_map('intval', $ops);
            if (in_array(self::OP_ID_READ, $ops, true) && !in_array($ops_id, $ops, true)) {
                $ops[] = $ops_id;
                $db->manipulate(
                    'UPDATE rbac_pa SET ops_id = ' . $db->quote(serialize($ops), 'text') .
                    ' WHERE rol_id = ' . $db->quote((int) $rec['rol_id'], 'integer') .
                    ' AND ref_id = ' . $db->quote((int) $rec['ref_id'], 'integer')
                );
            }
        }

        // role templates (e.g. course member) for new boards
        $set = $db->query(
            'SELECT rol_id, parent FROM rbac_templates WHERE type = ' . $db->quote(self::ID, 'text') .
            ' AND ops_id = ' . $db->quote(self::OP_ID_READ, 'integer')
        );
        $templates = [];
        while ($rec = $db->fetchAssoc($set)) {
            if (!in_array((int) $rec['rol_id'], $excluded, true)) {
                $templates[] = [(int) $rec['rol_id'], (int) $rec['parent']];
            }
        }
        foreach ($templates as [$rol_id, $parent]) {
            $check = $db->query(
                'SELECT ops_id FROM rbac_templates WHERE rol_id = ' . $db->quote($rol_id, 'integer') .
                ' AND parent = ' . $db->quote($parent, 'integer') .
                ' AND type = ' . $db->quote(self::ID, 'text') .
                ' AND ops_id = ' . $db->quote($ops_id, 'integer')
            );
            if ($db->fetchAssoc($check) === null) {
                $db->insert('rbac_templates', [
                    'rol_id' => ['integer', $rol_id],
                    'type' => ['text', self::ID],
                    'ops_id' => ['integer', $ops_id],
                    'parent' => ['integer', $parent],
                ]);
            }
        }
    }

    /**
     * First installation: ILIAS has no permissions for a new object type yet,
     * so only the system administrator could create and see whiteboards. The
     * permissions are set once like those of the ILIAS forum:
     * - role templates (global and local roles, e.g. course admin/tutor/member):
     *   whiteboard permissions derived from the forum permissions
     *   (write or "add thread" => also "Board bearbeiten")
     * - "create Udon Whiteboard" wherever "create forum" is allowed
     *   (role templates and existing courses, groups, categories, folders)
     * Nothing happens if permissions for whiteboards exist already, so
     * changes made by the administration are kept.
     */
    private function ensureDefaultPermissions(): void
    {
        $db = $this->db;

        $set = $db->query('SELECT COUNT(*) cnt FROM rbac_templates WHERE type = ' . $db->quote(self::ID, 'text'));
        $rec = $db->fetchAssoc($set);
        if ($rec === null || (int) $rec['cnt'] > 0) {
            return;
        }

        $ops = $this->getOperationIds(array_merge(
            array_keys(self::FORUM_OPS_TO_BOARD),
            ['edit_permission', 'visible', 'read', 'write', 'delete', self::OP_EDIT, 'create_frm', 'create_' . self::ID]
        ));
        if (!isset($ops[self::OP_EDIT], $ops['create_frm'], $ops['create_' . self::ID])) {
            return; // operations not there yet (plugin not activated)
        }
        $create_frm = $ops['create_frm'];
        $create_board = $ops['create_' . self::ID];

        // 1. role templates for whiteboards, derived from the forum
        $set = $db->query(
            'SELECT rol_id, parent, ops_id FROM rbac_templates WHERE type = ' . $db->quote(self::FORUM_TYPE, 'text')
        );
        $board_ops = []; // "rol_id:parent" => [ops]
        while ($rec = $db->fetchAssoc($set)) {
            $key = (int) $rec['rol_id'] . ':' . (int) $rec['parent'];
            $forum_op = array_search((int) $rec['ops_id'], $ops, true);
            if ($forum_op === false || !isset(self::FORUM_OPS_TO_BOARD[$forum_op])) {
                continue;
            }
            foreach (self::FORUM_OPS_TO_BOARD[$forum_op] as $board_op) {
                if ($board_op === self::OP_EDIT && (int) $rec['rol_id'] === self::ROLE_ID_ANONYMOUS) {
                    continue;
                }
                $board_ops[$key][$ops[$board_op]] = true;
            }
        }
        foreach ($board_ops as $key => $ids) {
            [$rol_id, $parent] = array_map('intval', explode(':', $key));
            foreach (array_keys($ids) as $ops_id) {
                $db->replace('rbac_templates', [
                    'rol_id' => ['integer', $rol_id],
                    'type' => ['text', self::ID],
                    'ops_id' => ['integer', $ops_id],
                    'parent' => ['integer', $parent],
                ], []);
            }
        }

        // 2a. "create whiteboard" in role templates where "create forum" is allowed
        $set = $db->query(
            'SELECT rol_id, type, parent FROM rbac_templates WHERE ops_id = ' . $db->quote($create_frm, 'integer')
        );
        $rows = [];
        while ($rec = $db->fetchAssoc($set)) {
            $rows[] = $rec;
        }
        foreach ($rows as $rec) {
            $db->replace('rbac_templates', [
                'rol_id' => ['integer', (int) $rec['rol_id']],
                'type' => ['text', (string) $rec['type']],
                'ops_id' => ['integer', $create_board],
                'parent' => ['integer', (int) $rec['parent']],
            ], []);
        }

        // 2b. ... and in existing containers (rbac_pa stores the operations as serialized array)
        $set = $db->query(
            'SELECT rol_id, ref_id, ops_id FROM rbac_pa WHERE ops_id LIKE ' . $db->quote('%i:' . $create_frm . ';%', 'text')
        );
        $rows = [];
        while ($rec = $db->fetchAssoc($set)) {
            $rows[] = $rec;
        }
        foreach ($rows as $rec) {
            $list = unserialize((string) $rec['ops_id'], ['allowed_classes' => false]);
            if (!is_array($list)) {
                continue;
            }
            $list = array_map('intval', $list);
            if (in_array($create_frm, $list, true) && !in_array($create_board, $list, true)) {
                $list[] = $create_board;
                $db->manipulate(
                    'UPDATE rbac_pa SET ops_id = ' . $db->quote(serialize($list), 'text') .
                    ' WHERE rol_id = ' . $db->quote((int) $rec['rol_id'], 'integer') .
                    ' AND ref_id = ' . $db->quote((int) $rec['ref_id'], 'integer')
                );
            }
        }
    }

    /**
     * @param string[] $names
     * @return array<string, int> operation name => ops_id
     */
    private function getOperationIds(array $names): array
    {
        $db = $this->db;
        $set = $db->query(
            'SELECT ops_id, operation FROM rbac_operations WHERE ' . $db->in('operation', array_values(array_unique($names)), false, 'text')
        );
        $ids = [];
        while ($rec = $db->fetchAssoc($set)) {
            $ids[(string) $rec['operation']] = (int) $rec['ops_id'];
        }
        return $ids;
    }
}
