<?php

declare(strict_types=1);

/**
 * Colour palettes of the board (defined in frontend/palettes.ts; the build
 * writes js/dist/palettes.json, from which the colours are shown here).
 *
 * Four palettes are always offered in the settings of a board; six more only
 * if they are switched on in the plugin configuration (Administration).
 */
class ilUdwPalettes
{
    public const DEFAULT = 'natural';
    public const BASE = ['natural', 'modern', 'warm', 'playful'];
    public const EXTRA = ['pastel', 'colorblind', 'ocean', 'forest', 'retro', 'print'];

    private const SETTINGS_MODULE = 'xudw';
    private const SETTINGS_KEY = 'extra_palettes';

    /** @var array<string, array{families: array<string, string[]>, stroke: string[], background: string[]}>|null */
    private static ?array $colors = null;

    /** @return string[] extra palettes switched on in the plugin configuration */
    public static function enabledExtras(): array
    {
        $value = (string) (new ilSetting(self::SETTINGS_MODULE))->get(self::SETTINGS_KEY, '');
        return array_values(array_intersect(self::EXTRA, explode(',', $value)));
    }

    /** @param string[] $ids */
    public static function saveEnabledExtras(array $ids): void
    {
        $ids = array_values(array_intersect(self::EXTRA, $ids));
        (new ilSetting(self::SETTINGS_MODULE))->set(self::SETTINGS_KEY, implode(',', $ids));
    }

    public static function deleteSettings(): void
    {
        (new ilSetting(self::SETTINGS_MODULE))->delete(self::SETTINGS_KEY);
    }

    /** @return string[] palettes offered in the settings of a board */
    public static function available(): array
    {
        return array_merge(self::BASE, self::enabledExtras());
    }

    public static function isKnown(string $id): bool
    {
        return in_array($id, self::BASE, true) || in_array($id, self::EXTRA, true);
    }

    /** The palette a board uses: its own, or the default if it is no longer offered. */
    public static function resolve(string $id): string
    {
        return in_array($id, self::available(), true) ? $id : self::DEFAULT;
    }

    /**
     * A row of colour fields (the middle shade of each colour family) for the
     * forms. Empty if the build output is missing.
     */
    public static function swatches(string $id): string
    {
        $palette = self::colors()[$id] ?? null;
        if ($palette === null) {
            return '';
        }
        $html = '';
        foreach ($palette['families'] as $shades) {
            $color = (string) ($shades[2] ?? '');
            if (preg_match('/^#[0-9a-f]{6}$/i', $color) !== 1) {
                continue;
            }
            $html .= '<span style="display:inline-block;width:1.4em;height:1.4em;margin:0.3em 0.15em 0 0;'
                . 'border-radius:3px;border:1px solid rgba(0,0,0,0.15);background:' . $color . '"></span>';
        }
        return '<span style="display:block">' . $html . '</span>';
    }

    /** @return array<string, array{families: array<string, string[]>, stroke: string[], background: string[]}> */
    private static function colors(): array
    {
        if (self::$colors === null) {
            $file = dirname(__DIR__) . '/js/dist/palettes.json';
            $data = is_readable($file) ? json_decode((string) file_get_contents($file), true) : null;
            self::$colors = is_array($data) && is_array($data['palettes'] ?? null) ? $data['palettes'] : [];
        }
        return self::$colors;
    }
}
