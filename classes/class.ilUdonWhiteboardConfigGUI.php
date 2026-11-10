<?php

declare(strict_types=1);

/**
 * Configuration of the plugin (Administration › Erweiterungen › Plugins ›
 * UdonWhiteboard › Konfigurieren): which of the six additional colour
 * palettes are offered in the settings of the boards.
 *
 * @ilCtrl_IsCalledBy ilUdonWhiteboardConfigGUI: ilObjComponentSettingsGUI
 */
class ilUdonWhiteboardConfigGUI extends ilPluginConfigGUI
{
    private const FIELD_PALETTES = 'extra_palettes';

    public function performCommand(string $cmd): void
    {
        switch ($cmd) {
            case 'save':
                $this->save();
                break;
            case 'configure':
            default:
                $this->configure();
                break;
        }
    }

    private function configure(?ilPropertyFormGUI $form = null): void
    {
        global $DIC;
        if ($form === null) {
            $form = $this->initForm();
            $form->setValuesByArray([self::FIELD_PALETTES => ilUdwPalettes::enabledExtras()]);
        }
        $DIC->ui()->mainTemplate()->setContent($form->getHTML());
    }

    private function save(): void
    {
        global $DIC;
        $form = $this->initForm();
        if (!$form->checkInput()) {
            $form->setValuesByPost();
            $this->configure($form);
            return;
        }
        $selected = $form->getInput(self::FIELD_PALETTES);
        ilUdwPalettes::saveEnabledExtras(is_array($selected) ? array_map('strval', $selected) : []);
        $DIC->ui()->mainTemplate()->setOnScreenMessage('success', $this->txt('config_saved'), true);
        $DIC->ctrl()->redirect($this, 'configure');
    }

    private function initForm(): ilPropertyFormGUI
    {
        global $DIC;
        $form = new ilPropertyFormGUI();
        $form->setTitle($this->txt('config_title'));
        $form->setFormAction($DIC->ctrl()->getFormAction($this, 'save'));

        $palettes = new ilCheckboxGroupInputGUI($this->txt('config_palettes'), self::FIELD_PALETTES);
        $palettes->setInfo($this->txt('config_palettes_info'));
        foreach (ilUdwPalettes::EXTRA as $id) {
            $option = new ilCheckboxOption($this->txt('palette_' . $id), $id);
            $option->setInfo($this->txt('palette_' . $id . '_info') . ilUdwPalettes::swatches($id));
            $palettes->addOption($option);
        }
        $form->addItem($palettes);

        $form->addCommandButton('save', $DIC->language()->txt('save'));
        return $form;
    }

    private function txt(string $key): string
    {
        return $this->getPluginObject()?->txt($key) ?? $key;
    }
}
