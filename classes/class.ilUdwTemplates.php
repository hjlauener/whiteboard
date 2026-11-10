<?php

declare(strict_types=1);

/**
 * Templates of the board ("Vorlagen"), sorted by topic. The list comes from
 * frontend/templates.ts (the build writes js/dist/templates.json); the board
 * draws the templates itself. In the plugin configuration single templates
 * can be switched off; all others (also new ones) are on.
 */
class ilUdwTemplates
{
    private const SETTINGS_MODULE = 'xudw';
    private const SETTINGS_KEY = 'disabled_templates';

    /** @var array<int, array{id: string, templates: string[]}>|null */
    private static ?array $topics = null;

    /** @return array<int, array{id: string, templates: string[]}> topics with their templates, in order */
    public static function topics(): array
    {
        if (self::$topics === null) {
            $file = dirname(__DIR__) . '/js/dist/templates.json';
            $data = is_readable($file) ? json_decode((string) file_get_contents($file), true) : null;
            $topics = [];
            foreach (is_array($data) ? $data : [] as $topic) {
                if (is_array($topic) && is_string($topic['id'] ?? null) && is_array($topic['templates'] ?? null)) {
                    $topics[] = [
                        'id' => $topic['id'],
                        'templates' => array_values(array_filter($topic['templates'], 'is_string')),
                    ];
                }
            }
            self::$topics = $topics;
        }
        return self::$topics;
    }

    /** @return string[] */
    public static function all(): array
    {
        return array_merge([], ...array_map(static fn(array $t): array => $t['templates'], self::topics()));
    }

    /** @return string[] templates switched off in the plugin configuration */
    public static function disabled(): array
    {
        $value = (string) (new ilSetting(self::SETTINGS_MODULE))->get(self::SETTINGS_KEY, '');
        return array_values(array_filter(explode(',', $value)));
    }

    /** @param string[] $enabled templates ticked in the configuration */
    public static function saveEnabled(array $enabled): void
    {
        $disabled = array_values(array_diff(self::all(), $enabled));
        (new ilSetting(self::SETTINGS_MODULE))->set(self::SETTINGS_KEY, implode(',', $disabled));
    }

    public static function deleteSettings(): void
    {
        (new ilSetting(self::SETTINGS_MODULE))->delete(self::SETTINGS_KEY);
    }

    /** @return array<int, array{id: string, templates: string[]}> topics with the switched-on templates (empty topics left out) */
    public static function enabledTopics(): array
    {
        $disabled = self::disabled();
        $out = [];
        foreach (self::topics() as $topic) {
            $templates = array_values(array_diff($topic['templates'], $disabled));
            if ($templates !== []) {
                $out[] = ['id' => $topic['id'], 'templates' => $templates];
            }
        }
        return $out;
    }

    /**
     * Texts of the template contents (language keys tplt_…) in the language
     * of the user, read from the language file of the plugin.
     *
     * @return array<string, string> key without "tplt_" => text
     */
    public static function contentTexts(string $plugin_dir, string $lang): array
    {
        $lang = in_array($lang, ['de', 'fr'], true) ? $lang : 'en';
        $file = $plugin_dir . '/lang/ilias_' . $lang . '.lang';
        $texts = [];
        foreach (is_readable($file) ? (array) file($file, FILE_IGNORE_NEW_LINES) : [] as $line) {
            $line = (string) $line;
            if (str_starts_with($line, 'tplt_') && str_contains($line, '#:#')) {
                [$key, $text] = explode('#:#', $line, 2);
                $texts[substr($key, 5)] = $text;
            }
        }
        return $texts;
    }
}
