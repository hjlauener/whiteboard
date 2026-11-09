<?php

declare(strict_types=1);

/**
 * Repository object plugin "Udon Whiteboard" (type xudw) for ILIAS 11.
 */
class ilUdonWhiteboardPlugin extends ilRepositoryObjectPlugin
{
    public const ID = 'xudw';
    public const NAME = 'UdonWhiteboard';

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
    }

    public function allowCopy(): bool
    {
        return false;
    }
}
