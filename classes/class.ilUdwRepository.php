<?php

declare(strict_types=1);

/**
 * Database access of the Udon Whiteboard.
 *
 * The board is stored as single elements (Excalidraw JSON). Every change gets
 * a revision number of the board; clients ask for "everything after revision
 * n" (polling). Writes run under a table lock, so revisions are handed out in
 * the order in which the changes are stored and no change is skipped.
 *
 * Conflicts (two people change the same element): the higher element version
 * wins; with the same version the lower version nonce wins (like Excalidraw).
 */
class ilUdwRepository
{
    public const TABLE_BOARD = 'rep_robj_xudw_board';
    public const TABLE_ELEMENT = 'rep_robj_xudw_el';
    public const TABLE_PRESENCE = 'rep_robj_xudw_pres';

    public const TABLES = [self::TABLE_BOARD, self::TABLE_ELEMENT, self::TABLE_PRESENCE];

    /** a person counts as "on the board" if seen within this many seconds */
    public const PRESENCE_TIMEOUT = 15;

    /** laser pointer: points are kept this many seconds (the others fetch them in this time) */
    public const LASER_KEEP = 3.0;

    public function __construct(private readonly ilDBInterface $db)
    {
    }

    public function createBoard(int $board_id): void
    {
        $this->db->replace(self::TABLE_BOARD, ['id' => ['integer', $board_id]], ['rev' => ['integer', 0]]);
    }

    public function getPalette(int $board_id): string
    {
        $result = $this->db->query('SELECT palette FROM ' . self::TABLE_BOARD
            . ' WHERE id = ' . $this->db->quote($board_id, 'integer'));
        $row = $this->db->fetchAssoc($result);
        return is_array($row) ? (string) $row['palette'] : ilUdwPalettes::DEFAULT;
    }

    public function setPalette(int $board_id, string $palette): void
    {
        $this->db->update(
            self::TABLE_BOARD,
            ['palette' => ['text', $palette]],
            ['id' => ['integer', $board_id]]
        );
    }

    public function deleteBoard(int $board_id): void
    {
        foreach ([self::TABLE_ELEMENT, self::TABLE_PRESENCE] as $table) {
            $this->db->manipulate('DELETE FROM ' . $table . ' WHERE board_id = ' . $this->db->quote($board_id, 'integer'));
        }
        $this->db->manipulate('DELETE FROM ' . self::TABLE_BOARD . ' WHERE id = ' . $this->db->quote($board_id, 'integer'));
    }

    /**
     * Stores the elements that are newer than the stored ones.
     *
     * @param array<int, array{id: string, version: int, nonce: int, deleted: bool, json: string}> $elements
     */
    public function saveElements(int $board_id, array $elements, int $user_id): void
    {
        if ($elements === []) {
            return;
        }

        $atom = $this->db->buildAtomQuery();
        $atom->addTableLock(self::TABLE_BOARD);
        $atom->addTableLock(self::TABLE_ELEMENT);
        $atom->addQueryCallable(function (ilDBInterface $db) use ($board_id, $elements, $user_id): void {
            $board_q = $db->quote($board_id, 'integer');

            // current versions of the sent elements
            $ids = array_map(static fn(array $el): string => $el['id'], $elements);
            $set = $db->query(
                'SELECT el_id, el_version, el_nonce FROM ' . self::TABLE_ELEMENT .
                ' WHERE board_id = ' . $board_q . ' AND ' . $db->in('el_id', $ids, false, 'text')
            );
            $stored = [];
            while ($rec = $db->fetchAssoc($set)) {
                $stored[(string) $rec['el_id']] = [(int) $rec['el_version'], (int) $rec['el_nonce']];
            }

            $accepted = [];
            foreach ($elements as $el) {
                $current = $stored[$el['id']] ?? null;
                if ($current === null
                    || $el['version'] > $current[0]
                    || ($el['version'] === $current[0] && $el['nonce'] < $current[1])) {
                    $accepted[$el['id']] = $el;
                }
            }
            if ($accepted === []) {
                return;
            }

            // next revision of the board
            $set = $db->query('SELECT rev FROM ' . self::TABLE_BOARD . ' WHERE id = ' . $board_q);
            $rec = $db->fetchAssoc($set);
            $rev = ($rec === null ? 0 : (int) $rec['rev']) + 1;
            if ($rec === null) {
                $db->insert(self::TABLE_BOARD, ['id' => ['integer', $board_id], 'rev' => ['integer', $rev]]);
            } else {
                $db->update(self::TABLE_BOARD, ['rev' => ['integer', $rev]], ['id' => ['integer', $board_id]]);
            }

            $now = time();
            foreach ($accepted as $el) {
                $values = [
                    'el_version' => ['integer', $el['version']],
                    'el_nonce' => ['integer', $el['nonce']],
                    'rev' => ['integer', $rev],
                    'is_deleted' => ['integer', $el['deleted'] ? 1 : 0],
                    'el_json' => ['clob', $el['json']],
                    'last_user' => ['integer', $user_id],
                    'last_update' => ['integer', $now],
                ];
                if (isset($stored[$el['id']])) {
                    $db->update(self::TABLE_ELEMENT, $values, [
                        'board_id' => ['integer', $board_id],
                        'el_id' => ['text', $el['id']],
                    ]);
                } else {
                    $db->insert(self::TABLE_ELEMENT, $values + [
                        'board_id' => ['integer', $board_id],
                        'el_id' => ['text', $el['id']],
                    ]);
                }
            }
        });
        $atom->run();
    }

    /**
     * Elements changed after revision $since (all elements for 0, without the
     * deleted ones) and the current revision.
     *
     * @return array{rev: int, elements: string[]} elements as JSON strings
     */
    public function getChanges(int $board_id, int $since): array
    {
        $board_q = $this->db->quote($board_id, 'integer');

        // revision first: a change stored meanwhile has a higher one and comes with the next request
        $set = $this->db->query('SELECT rev FROM ' . self::TABLE_BOARD . ' WHERE id = ' . $board_q);
        $rec = $this->db->fetchAssoc($set);
        $rev = $rec === null ? 0 : (int) $rec['rev'];

        if ($since >= $rev) {
            return ['rev' => $rev, 'elements' => []];
        }

        $sql = 'SELECT el_json FROM ' . self::TABLE_ELEMENT .
            ' WHERE board_id = ' . $board_q .
            ' AND rev > ' . $this->db->quote($since, 'integer') .
            ' AND rev <= ' . $this->db->quote($rev, 'integer');
        if ($since === 0) {
            $sql .= ' AND is_deleted = 0';
        }
        $set = $this->db->query($sql);
        $elements = [];
        while ($rec = $this->db->fetchAssoc($set)) {
            $elements[] = (string) $rec['el_json'];
        }

        return ['rev' => $rev, 'elements' => $elements];
    }

    /**
     * Remembers that the user is on the board and where the pointer is.
     */
    /**
     * Pointer position and sign of life; with laser points (laser pointer of
     * this person) they are added to the points of the last seconds, as one
     * numbered batch.
     *
     * @param array<int, array{0: float, 1: float, 2: float, 3: int}> $laser [time in ms (clock of the sender), x, y, end of stroke]
     */
    public function touchPresence(int $board_id, int $user_id, ?float $x, ?float $y, array $laser = []): void
    {
        $where = ['board_id' => ['integer', $board_id], 'user_id' => ['integer', $user_id]];
        $set = $this->db->query('SELECT laser FROM ' . self::TABLE_PRESENCE
            . ' WHERE board_id = ' . $this->db->quote($board_id, 'integer')
            . ' AND user_id = ' . $this->db->quote($user_id, 'integer'));
        $row = $this->db->fetchAssoc($set);

        $values = [
            'pointer_x' => ['float', $x],
            'pointer_y' => ['float', $y],
            'last_seen' => ['integer', time()],
        ];
        if ($laser !== []) {
            $batches = $this->recentLaser(is_array($row) ? $row['laser'] : null);
            $last = end($batches);
            $batches[] = ['s' => is_array($last) ? $last['s'] + 1 : 1, 'a' => microtime(true), 'p' => $laser];
            $values['laser'] = ['clob', (string) json_encode($batches)];
        }

        if (is_array($row)) {
            $this->db->update(self::TABLE_PRESENCE, $values, $where);
        } else {
            try {
                $this->db->insert(self::TABLE_PRESENCE, $where + $values);
            } catch (Throwable) {
                // inserted at the same moment by another tab of the same person
                $this->db->update(self::TABLE_PRESENCE, $values, $where);
            }
        }
    }

    /**
     * Laser batches of the last seconds.
     *
     * @return array<int, array{s: int, a: float, p: array<mixed>}>
     */
    private function recentLaser(mixed $json): array
    {
        $batches = is_string($json) && $json !== '' ? json_decode($json, true) : null;
        if (!is_array($batches)) {
            return [];
        }
        $limit = microtime(true) - self::LASER_KEEP;
        return array_values(array_filter(
            $batches,
            static fn($b): bool => is_array($b) && is_int($b['s'] ?? null) && (float) ($b['a'] ?? 0) >= $limit && is_array($b['p'] ?? null)
        ));
    }

    /**
     * People currently on the board.
     *
     * @return array<int, array{id: int, x: ?float, y: ?float, laser: array<int, array{s: int, p: array<mixed>}>}>
     */
    public function getPresentUsers(int $board_id): array
    {
        $set = $this->db->query(
            'SELECT user_id, pointer_x, pointer_y, laser FROM ' . self::TABLE_PRESENCE .
            ' WHERE board_id = ' . $this->db->quote($board_id, 'integer') .
            ' AND last_seen >= ' . $this->db->quote(time() - self::PRESENCE_TIMEOUT, 'integer')
        );
        $users = [];
        while ($rec = $this->db->fetchAssoc($set)) {
            $users[] = [
                'id' => (int) $rec['user_id'],
                'x' => $rec['pointer_x'] === null ? null : (float) $rec['pointer_x'],
                'y' => $rec['pointer_y'] === null ? null : (float) $rec['pointer_y'],
                'laser' => array_map(
                    static fn(array $b): array => ['s' => $b['s'], 'p' => $b['p']],
                    $this->recentLaser($rec['laser'])
                ),
            ];
        }
        return $users;
    }
}
