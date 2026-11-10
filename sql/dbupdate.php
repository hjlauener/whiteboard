<#1>
<?php
// Initial step. Whiteboard specific tables will be added in later steps.
?>
<#2>
<?php
// one row per whiteboard: revision counter of the board
if (!$ilDB->tableExists('rep_robj_xudw_board')) {
    $ilDB->createTable('rep_robj_xudw_board', [
        'id' => ['type' => 'integer', 'length' => 4, 'notnull' => true],
        'rev' => ['type' => 'integer', 'length' => 8, 'notnull' => true, 'default' => 0],
    ]);
    $ilDB->addPrimaryKey('rep_robj_xudw_board', ['id']);
}

// elements of the board (Excalidraw JSON, one row per element)
if (!$ilDB->tableExists('rep_robj_xudw_el')) {
    $ilDB->createTable('rep_robj_xudw_el', [
        'board_id' => ['type' => 'integer', 'length' => 4, 'notnull' => true],
        'el_id' => ['type' => 'text', 'length' => 64, 'notnull' => true],
        'el_version' => ['type' => 'integer', 'length' => 4, 'notnull' => true, 'default' => 0],
        'el_nonce' => ['type' => 'integer', 'length' => 8, 'notnull' => true, 'default' => 0],
        'rev' => ['type' => 'integer', 'length' => 8, 'notnull' => true, 'default' => 0],
        'is_deleted' => ['type' => 'integer', 'length' => 1, 'notnull' => true, 'default' => 0],
        'el_json' => ['type' => 'clob', 'notnull' => false],
        'last_user' => ['type' => 'integer', 'length' => 4, 'notnull' => true, 'default' => 0],
        'last_update' => ['type' => 'integer', 'length' => 4, 'notnull' => true, 'default' => 0],
    ]);
    $ilDB->addPrimaryKey('rep_robj_xudw_el', ['board_id', 'el_id']);
    $ilDB->addIndex('rep_robj_xudw_el', ['board_id', 'rev'], 'i1');
}

// who is on the board right now (pointer position, last sign of life)
if (!$ilDB->tableExists('rep_robj_xudw_pres')) {
    $ilDB->createTable('rep_robj_xudw_pres', [
        'board_id' => ['type' => 'integer', 'length' => 4, 'notnull' => true],
        'user_id' => ['type' => 'integer', 'length' => 4, 'notnull' => true],
        'pointer_x' => ['type' => 'float', 'notnull' => false],
        'pointer_y' => ['type' => 'float', 'notnull' => false],
        'last_seen' => ['type' => 'integer', 'length' => 4, 'notnull' => true, 'default' => 0],
    ]);
    $ilDB->addPrimaryKey('rep_robj_xudw_pres', ['board_id', 'user_id']);
}
?>
<#3>
<?php
// colour palette of the board (see ilUdwPalettes)
if (!$ilDB->tableColumnExists('rep_robj_xudw_board', 'palette')) {
    $ilDB->addTableColumn('rep_robj_xudw_board', 'palette', [
        'type' => 'text', 'length' => 20, 'notnull' => true, 'default' => 'natural',
    ]);
}
?>
<#4>
<?php
// laser pointer: the points of the last seconds (JSON), so that the others see the trail
if (!$ilDB->tableColumnExists('rep_robj_xudw_pres', 'laser')) {
    $ilDB->addTableColumn('rep_robj_xudw_pres', 'laser', ['type' => 'clob', 'notnull' => false]);
}
?>
