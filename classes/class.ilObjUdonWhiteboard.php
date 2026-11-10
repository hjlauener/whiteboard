<?php

declare(strict_types=1);

/**
 * Application class of the Udon Whiteboard repository object.
 *
 * Title and description are standard ILIAS object data; the content of the
 * board and its colour palette are stored by ilUdwRepository.
 */
class ilObjUdonWhiteboard extends ilObjectPlugin
{
    private string $palette = ilUdwPalettes::DEFAULT;

    protected function initType(): void
    {
        $this->setType(ilUdonWhiteboardPlugin::ID);
    }

    protected function doCreate(bool $clone_mode = false): void
    {
        $this->getRepository()->createBoard($this->getId());
        $this->getRepository()->setPalette($this->getId(), $this->palette);
    }

    protected function doRead(): void
    {
        $this->palette = $this->getRepository()->getPalette($this->getId());
    }

    protected function doUpdate(): void
    {
        $this->getRepository()->setPalette($this->getId(), $this->palette);
    }

    public function getPalette(): string
    {
        return $this->palette;
    }

    public function setPalette(string $palette): void
    {
        if (ilUdwPalettes::isKnown($palette)) {
            $this->palette = $palette;
        }
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
