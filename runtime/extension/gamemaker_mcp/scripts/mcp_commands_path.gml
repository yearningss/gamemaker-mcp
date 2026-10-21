/// @description MCP Commands - Path & Motion Planning

function mcp_register_commands_path() {

    mcp_route("get_path_list", function(_params) {
        var _assets = mcp_get_assets_by_type(asset_path);
        return {
            paths: _assets,
            count: array_length(_assets)
        };
    });

    mcp_route("get_path_info", function(_params) {
        if (!variable_struct_exists(_params, "path_name")) {
            return { __error: "Missing required parameter: path_name", __code: -32602 };
        }

        var _path = asset_get_index(_params.path_name);
        if (_path < 0) {
            return { __error: "Path not found: " + _params.path_name, __code: -32602 };
        }

        return {
            name: _params.path_name,
            length: path_get_length(_path),
            num_points: path_get_number(_path),
            closed: path_get_closed(_path),
            precision: path_get_precision(_path)
        };
    });

    mcp_route("path_to_points", function(_params) {
        if (!variable_struct_exists(_params, "path_name")) {
            return { __error: "Missing required parameter: path_name", __code: -32602 };
        }

        var _path = asset_get_index(_params.path_name);
        if (_path < 0) {
            return { __error: "Path not found: " + _params.path_name, __code: -32602 };
        }

        var _num = variable_struct_exists(_params, "num_points") ? _params.num_points : 20;
        if (_num < 2) _num = 2;

        var _points = [];
        for (var _i = 0; _i < _num; _i++) {
            var _pos = _i / (_num - 1);
            array_push(_points, {
                x: path_get_x(_path, _pos),
                y: path_get_y(_path, _pos),
                speed: path_get_speed(_path, _pos)
            });
        }

        return {
            path_name: _params.path_name,
            points: _points,
            count: array_length(_points)
        };
    });

    mcp_route("create_path", function(_params) {
        var _p = path_add();

        if (variable_struct_exists(_params, "closed")) {
            path_set_closed(_p, _params.closed);
        }
        if (variable_struct_exists(_params, "precision")) {
            path_set_precision(_p, _params.precision);
        }

        // Track the created path
        var _name = variable_struct_exists(_params, "name") ? _params.name : ("mcp_path_" + string(_p));
        variable_struct_set(global.__mcp_tracked_paths, string(_p), {
            path_id: _p,
            name: _name
        });

        return {
            path_id: _p,
            name: _name,
            success: true
        };
    });

    mcp_route("add_path_point", function(_params) {
        if (!variable_struct_exists(_params, "path_id")) {
            return { __error: "Missing required parameter: path_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "x")) {
            return { __error: "Missing required parameter: x", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameter: y", __code: -32602 };
        }

        var _pid = _params.path_id;
        if (!path_exists(_pid)) {
            return { __error: "Path does not exist: " + string(_pid), __code: -32602 };
        }

        var _speed = variable_struct_exists(_params, "speed") ? _params.speed : 1;
        path_add_point(_pid, _params.x, _params.y, _speed);

        return {
            path_id: _pid,
            x: _params.x,
            y: _params.y,
            speed: _speed,
            success: true
        };
    });

    mcp_route("set_instance_path", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        // Resolve path from name or id
        var _path = -1;
        var _path_label = "";
        if (variable_struct_exists(_params, "path_name")) {
            _path = asset_get_index(_params.path_name);
            _path_label = _params.path_name;
            if (_path < 0) {
                return { __error: "Path not found: " + _params.path_name, __code: -32602 };
            }
        } else if (variable_struct_exists(_params, "path_id")) {
            _path = _params.path_id;
            _path_label = string(_path);
            if (!path_exists(_path)) {
                return { __error: "Path does not exist: " + string(_path), __code: -32602 };
            }
        } else {
            return { __error: "Must provide either path_name or path_id", __code: -32602 };
        }

        var _speed = variable_struct_exists(_params, "speed") ? _params.speed : 1;
        var _end_action = variable_struct_exists(_params, "end_action") ? _params.end_action : 0;

        with (_inst) {
            path_start(_path, _speed, _end_action, false);
        }

        return {
            instance_id: _inst,
            path: _path_label,
            speed: _speed,
            end_action: _end_action,
            success: true
        };
    });

    mcp_route("create_mp_grid", function(_params) {
        if (!variable_struct_exists(_params, "x")) {
            return { __error: "Missing required parameter: x", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameter: y", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "width")) {
            return { __error: "Missing required parameter: width", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "height")) {
            return { __error: "Missing required parameter: height", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "cell_width")) {
            return { __error: "Missing required parameter: cell_width", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "cell_height")) {
            return { __error: "Missing required parameter: cell_height", __code: -32602 };
        }

        var _x = _params.x;
        var _y = _params.y;
        var _w = _params.width;
        var _h = _params.height;
        var _cw = _params.cell_width;
        var _ch = _params.cell_height;

        var _cells_h = floor(_w / _cw);
        var _cells_v = floor(_h / _ch);

        if (_cells_h < 1 || _cells_v < 1) {
            return { __error: "Grid dimensions too small: cells_h=" + string(_cells_h) + " cells_v=" + string(_cells_v), __code: -32602 };
        }

        var _grid = mp_grid_create(_x, _y, _cells_h, _cells_v, _cw, _ch);

        // Track the grid
        variable_struct_set(global.__mcp_tracked_mp_grids, string(_grid), {
            grid_id: _grid,
            x: _x,
            y: _y,
            width: _w,
            height: _h,
            cells_h: _cells_h,
            cells_v: _cells_v
        });

        return {
            grid_id: _grid,
            cells_h: _cells_h,
            cells_v: _cells_v,
            success: true
        };
    });

    mcp_route("find_mp_path", function(_params) {
        if (!variable_struct_exists(_params, "grid_id")) {
            return { __error: "Missing required parameter: grid_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "x1")) {
            return { __error: "Missing required parameter: x1", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "y1")) {
            return { __error: "Missing required parameter: y1", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "x2")) {
            return { __error: "Missing required parameter: x2", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "y2")) {
            return { __error: "Missing required parameter: y2", __code: -32602 };
        }

        var _grid = _params.grid_id;
        if (!variable_struct_exists(global.__mcp_tracked_mp_grids, string(_grid))) {
            return { __error: "MP grid not found: " + string(_grid), __code: -32602 };
        }

        var _x1 = _params.x1;
        var _y1 = _params.y1;
        var _x2 = _params.x2;
        var _y2 = _params.y2;
        var _allowdiag = variable_struct_exists(_params, "allowdiag") ? _params.allowdiag : true;

        // Create a temporary path for the result
        var _temp_path = path_add();
        var _found = mp_grid_path(_grid, _temp_path, _x1, _y1, _x2, _y2, _allowdiag);

        if (!_found) {
            path_delete(_temp_path);
            return {
                success: false,
                message: "No path found between the given points"
            };
        }

        // Extract points from the result path
        var _num = path_get_number(_temp_path);
        var _points = [];
        for (var _i = 0; _i < _num; _i++) {
            array_push(_points, {
                x: path_get_point_x(_temp_path, _i),
                y: path_get_point_y(_temp_path, _i)
            });
        }

        var _len = path_get_length(_temp_path);
        path_delete(_temp_path);

        return {
            success: true,
            points: _points,
            count: _num,
            length: _len
        };
    });
}
