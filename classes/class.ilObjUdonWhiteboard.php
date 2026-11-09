<?php

declare(strict_types=1);

/**
 * Application class of the Udon Whiteboard repository object.
 *
 * For now the object only consists of the standard ILIAS object data
 * (title, description). Whiteboard specific data will follow.
 */
class ilObjUdonWhiteboard extends ilObjectPlugin
{
    protected function initType(): void
    {
        $this->setType(ilUdonWhiteboardPlugin::ID);
    }

    protected function doCreate(bool $clone_mode = false): void
    {
    }

    protected function doRead(): void
    {
    }

    protected function doUpdate(): void
    {
    }

    protected function doDelete(): void
    {
    }
}
