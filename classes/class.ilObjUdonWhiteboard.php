<?php

declare(strict_types=1);

/**
 * Application class of the Udon Whiteboard repository object.
 *
 * Title and description are standard ILIAS object data; the content of the
 * board is stored by ilUdwRepository.
 */
class ilObjUdonWhiteboard extends ilObjectPlugin
{
    protected function initType(): void
    {
        $this->setType(ilUdonWhiteboardPlugin::ID);
    }

    protected function doCreate(bool $clone_mode = false): void
    {
        $this->getRepository()->createBoard($this->getId());
    }

    protected function doRead(): void
    {
    }

    protected function doUpdate(): void
    {
    }

    protected function doDelete(): void
    {
        $this->getRepository()->deleteBoard($this->getId());
    }

    private function getRepository(): ilUdwRepository
    {
        global $DIC;
        return new ilUdwRepository($DIC->database());
    }
}
