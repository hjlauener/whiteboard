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

    public function __construct(private readonly ilDBInterface $db)
    {
    }

    public function createBoard(int $board_id): void
    {
        $this->db->replace(self::TABLE_BOARD, ['id' => ['integer', $board_id]], ['rev' => ['integer', 0]]);
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
    public function touchPresence(int $board_id, int $user_id, ?float $x, ?float $y): void
    {
        $this->db->replace(
            self::TABLE_PRESENCE,
            ['board_id' => ['integer', $board_id], 'user_id' => ['integer', $user_id]],
            [
                'pointer_x' => ['float', $x],
                'pointer_y' => ['float', $y],
                'last_seen' => ['integer', time()],
            ]
        );
    }

    /**
     * People currently on the board.
     *
     * @return array<int, array{id: int, x: ?float, y: ?float}>
     */
    public function getPresentUsers(int $board_id): array
    {
        $set = $this->db->query(
            'SELECT user_id, pointer_x, pointer_y FROM ' . self::TABLE_PRESENCE .
            ' WHERE board_id = ' . $this->db->quote($board_id, 'integer') .
            ' AND last_seen >= ' . $this->db->quote(time() - self::PRESENCE_TIMEOUT, 'integer')
        );
        $users = [];
        while ($rec = $this->db->fetchAssoc($set)) {
            $users[] = [
                'id' => (int) $rec['user_id'],
                'x' => $rec['pointer_x'] === null ? null : (float) $rec['pointer_x'],
                'y' => $rec['pointer_y'] === null ? null : (float) $rec['pointer_y'],
            ];
        }
        return $users;
    }
}
