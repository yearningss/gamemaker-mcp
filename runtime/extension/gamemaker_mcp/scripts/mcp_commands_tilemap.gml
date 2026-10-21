/// @description MCP Commands - Tilemap Operations

function mcp_register_commands_tilemap() {

    mcp_route("get_tilemap_data", function(_params) {
        if (!variable_struct_exists(_params, "layer_name")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _tm = layer_tilemap_get_id(_lid);
        if (_tm == -1) {
            return { __error: "No tilemap found on layer: " + _params.layer_name, __code: -32602 };
        }

        var _x1 = variable_struct_exists(_params, "x1") ? _params.x1 : 0;
        var _y1 = variable_struct_exists(_params, "y1") ? _params.y1 : 0;
        var _x2 = variable_struct_exists(_params, "x2") ? _params.x2 : tilemap_get_width(_tm) - 1;
        var _y2 = variable_struct_exists(_params, "y2") ? _params.y2 : tilemap_get_height(_tm) - 1;

        // Clamp ranges
        _x2 = min(_x2, tilemap_get_width(_tm) - 1);
        _y2 = min(_y2, tilemap_get_height(_tm) - 1);

        var _data = [];
        for (var _cy = _y1; _cy <= _y2; _cy++) {
            var _row = [];
            for (var _cx = _x1; _cx <= _x2; _cx++) {
                array_push(_row, tilemap_get(_tm, _cx, _cy));
            }
            array_push(_data, _row);
        }

        return {
            layer_name: _params.layer_name,
            tilemap_id: _tm,
            range: { x1: _x1, y1: _y1, x2: _x2, y2: _y2 },
            data: _data
        };
    });

    mcp_route("set_tilemap_cell", function(_params) {
        // Bridge sends "tile_index", accept both "tile_index" and "tile_data"
        if (variable_struct_exists(_params, "tile_index") && !variable_struct_exists(_params, "tile_data")) {
            _params.tile_data = _params.tile_index;
        }
        if (!variable_struct_exists(_params, "layer_name") ||
            !variable_struct_exists(_params, "cell_x") ||
            !variable_struct_exists(_params, "cell_y") ||
            !variable_struct_exists(_params, "tile_data")) {
            return { __error: "Missing required parameters: layer_name, cell_x, cell_y, tile_index", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _tm = layer_tilemap_get_id(_lid);
        if (_tm == -1) {
            return { __error: "No tilemap found on layer: " + _params.layer_name, __code: -32602 };
        }

        tilemap_set(_tm, _params.tile_data, _params.cell_x, _params.cell_y);

        return {
            success: true,
            layer_name: _params.layer_name,
            cell_x: _params.cell_x,
            cell_y: _params.cell_y,
            tile_data: _params.tile_data
        };
    });

    mcp_route("get_tilemap_info", function(_params) {
        if (!variable_struct_exists(_params, "layer_name")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _tm = layer_tilemap_get_id(_lid);
        if (_tm == -1) {
            return { __error: "No tilemap found on layer: " + _params.layer_name, __code: -32602 };
        }

        return {
            layer_name: _params.layer_name,
            tilemap_id: _tm,
            width: tilemap_get_width(_tm),
            height: tilemap_get_height(_tm),
            cell_width: tilemap_get_cell_width(_tm),
            cell_height: tilemap_get_cell_height(_tm),
            x: tilemap_get_x(_tm),
            y: tilemap_get_y(_tm)
        };
    });

    mcp_route("clear_tilemap", function(_params) {
        if (!variable_struct_exists(_params, "layer_name")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _tm = layer_tilemap_get_id(_lid);
        if (_tm == -1) {
            return { __error: "No tilemap found on layer: " + _params.layer_name, __code: -32602 };
        }

        var _tile = variable_struct_exists(_params, "tile_data") ? _params.tile_data : 0;
        tilemap_clear(_tm, _tile);

        return {
            success: true,
            layer_name: _params.layer_name,
            cleared_with: _tile
        };
    });

    mcp_route("get_tileset_info", function(_params) {
        if (!variable_struct_exists(_params, "tileset_name")) {
            return { __error: "Missing required parameter: tileset_name", __code: -32602 };
        }

        var _ts = asset_get_index(_params.tileset_name);
        if (_ts < 0) {
            return { __error: "Tileset not found: " + _params.tileset_name, __code: -32602 };
        }

        return {
            tileset_name: _params.tileset_name,
            tileset_index: _ts,
            tile_width: tileset_get_info(_ts).tile_width,
            tile_height: tileset_get_info(_ts).tile_height,
            tile_count: tileset_get_info(_ts).tile_count,
            columns: tileset_get_info(_ts).tile_columns,
            rows: tileset_get_info(_ts).tile_rows
        };
    });

    mcp_route("fill_tilemap_region", function(_params) {
        // Bridge sends "tile_index", accept both "tile_index" and "tile_data"
        if (variable_struct_exists(_params, "tile_index") && !variable_struct_exists(_params, "tile_data")) {
            _params.tile_data = _params.tile_index;
        }
        if (!variable_struct_exists(_params, "layer_name") ||
            !variable_struct_exists(_params, "x1") ||
            !variable_struct_exists(_params, "y1") ||
            !variable_struct_exists(_params, "x2") ||
            !variable_struct_exists(_params, "y2") ||
            !variable_struct_exists(_params, "tile_data")) {
            return { __error: "Missing required parameters: layer_name, x1, y1, x2, y2, tile_index", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _tm = layer_tilemap_get_id(_lid);
        if (_tm == -1) {
            return { __error: "No tilemap found on layer: " + _params.layer_name, __code: -32602 };
        }

        var _x1 = _params.x1;
        var _y1 = _params.y1;
        var _x2 = min(_params.x2, tilemap_get_width(_tm) - 1);
        var _y2 = min(_params.y2, tilemap_get_height(_tm) - 1);

        var _cells_set = 0;
        for (var _cy = _y1; _cy <= _y2; _cy++) {
            for (var _cx = _x1; _cx <= _x2; _cx++) {
                tilemap_set(_tm, _params.tile_data, _cx, _cy);
                _cells_set++;
            }
        }

        return {
            success: true,
            layer_name: _params.layer_name,
            region: { x1: _x1, y1: _y1, x2: _x2, y2: _y2 },
            tile_data: _params.tile_data,
            cells_set: _cells_set
        };
    });

}
