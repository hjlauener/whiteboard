<?php

declare(strict_types=1);

/**
 * List GUI of the Udon Whiteboard repository object (presentation in the
 * repository container lists).
 */
class ilObjUdonWhiteboardListGUI extends ilObjectPluginListGUI
{
    public function initType(): void
    {
        $this->setType(ilUdonWhiteboardPlugin::ID);
    }

    public function getGuiClass(): string
    {
        return ilObjUdonWhiteboardGUI::class;
    }

    public function initCommands(): array
    {
        return [
            [
                'permission' => 'read',
                'cmd' => 'showContent',
                'default' => true,
            ],
            [
                'permission' => 'write',
                'cmd' => 'editProperties',
                'txt' => $this->txt('edit'),
                'default' => false,
            ],
        ];
    }
}
