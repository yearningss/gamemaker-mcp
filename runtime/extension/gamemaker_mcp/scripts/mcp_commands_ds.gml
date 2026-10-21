/// @description MCP Commands - Data Structure Inspection

function mcp_register_commands_ds() {

    mcp_route("inspect_ds_list", function(_params) {
        if (!variable_struct_exists(_params, "list_id")) {
            return { __error: "Missing required parameter: list_id", __code: -32602 };
        }

        var _list = _params.list_id;
        if (!ds_exists(_list, ds_type_list)) {
            return { __error: "DS list does not exist: " + string(_list), __code: -32602 };
        }

        var _size = ds_list_size(_list);
        var _start = variable_struct_exists(_params, "start") ? _params.start : 0;
        var _count = variable_struct_exists(_params, "count") ? _params.count : _size;
        var _end = min(_start + _count, _size);

        var _values = [];
        for (var _i = _start; _i < _end; _i++) {
            array_push(_values, ds_list_find_value(_list, _i));
        }

        return {
            list_id: _list,
            size: _size,
            start: _start,
            count: _end - _start,
            values: _values
        };
    });

    mcp_route("inspect_ds_map", function(_params) {
        if (!variable_struct_exists(_params, "map_id")) {
            return { __error: "Missing required parameter: map_id", __code: -32602 };
        }

        var _map = _params.map_id;
        if (!ds_exists(_map, ds_type_map)) {
            return { __error: "DS map does not exist: " + string(_map), __code: -32602 };
        }

        var _size = ds_map_size(_map);
        var _entries = {};
        var _keys = [];

        var _key = ds_map_find_first(_map);
        for (var _i = 0; _i < _size; _i++) {
            var _val = ds_map_find_value(_map, _key);
            variable_struct_set(_entries, string(_key), _val);
            array_push(_keys, _key);
            _key = ds_map_find_next(_map, _key);
        }

        return {
            map_id: _map,
            size: _size,
            keys: _keys,
            entries: _entries
        };
    });

    mcp_route("inspect_ds_grid", function(_params) {
        if (!variable_struct_exists(_params, "grid_id")) {
            return { __error: "Missing required parameter: grid_id", __code: -32602 };
        }

        var _grid = _params.grid_id;
        if (!ds_exists(_grid, ds_type_grid)) {
            return { __error: "DS grid does not exist: " + string(_grid), __code: -32602 };
        }

        var _w = ds_grid_width(_grid);
        var _h = ds_grid_height(_grid);

        var _x1 = variable_struct_exists(_params, "x1") ? _params.x1 : 0;
        var _y1 = variable_struct_exists(_params, "y1") ? _params.y1 : 0;
        var _x2 = variable_struct_exists(_params, "x2") ? _params.x2 : _w - 1;
        var _y2 = variable_struct_exists(_params, "y2") ? _params.y2 : _h - 1;

        _x2 = min(_x2, _w - 1);
        _y2 = min(_y2, _h - 1);

        var _cells = [];
        for (var _iy = _y1; _iy <= _y2; _iy++) {
            var _row = [];
            for (var _ix = _x1; _ix <= _x2; _ix++) {
                array_push(_row, ds_grid_get(_grid, _ix, _iy));
            }
            array_push(_cells, _row);
        }

        return {
            grid_id: _grid,
            width: _w,
            height: _h,
            region: { x1: _x1, y1: _y1, x2: _x2, y2: _y2 },
            cells: _cells
        };
    });

    mcp_route("inspect_ds_stack", function(_params) {
        if (!variable_struct_exists(_params, "stack_id")) {
            return { __error: "Missing required parameter: stack_id", __code: -32602 };
        }

        var _stack = _params.stack_id;
        if (!ds_exists(_stack, ds_type_stack)) {
            return { __error: "DS stack does not exist: " + string(_stack), __code: -32602 };
        }

        var _size = ds_stack_size(_stack);

        // Copy stack contents to a temporary list to inspect without destroying
        var _values = [];
        var _temp_stack = ds_stack_create();

        // Pop all items from original, recording them
        for (var _i = 0; _i < _size; _i++) {
            var _val = ds_stack_pop(_stack);
            array_push(_values, _val);
            ds_stack_push(_temp_stack, _val);
        }

        // Restore original stack in correct order
        for (var _i = 0; _i < _size; _i++) {
            ds_stack_push(_stack, ds_stack_pop(_temp_stack));
        }

        ds_stack_destroy(_temp_stack);

        return {
            stack_id: _stack,
            size: _size,
            values: _values,
            note: "Values are listed from top to bottom of the stack."
        };
    });

    mcp_route("inspect_array", function(_params) {
        // Bridge sends "variable", accept both "variable" and "variable_name"
        if (!variable_struct_exists(_params, "instance_id") ||
            (!variable_struct_exists(_params, "variable") && !variable_struct_exists(_params, "variable_name"))) {
            return { __error: "Missing required parameters: instance_id, variable", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _var_name = variable_struct_exists(_params, "variable") ? _params.variable : _params.variable_name;
        if (!variable_instance_exists(_inst, _var_name)) {
            return { __error: "Variable does not exist on instance: " + _var_name, __code: -32602 };
        }

        var _arr = variable_instance_get(_inst, _var_name);
        if (!is_array(_arr)) {
            return { __error: "Variable is not an array: " + _var_name, __code: -32602 };
        }

        var _total = array_length(_arr);
        var _start = variable_struct_exists(_params, "start") ? _params.start : 0;
        var _count = variable_struct_exists(_params, "count") ? _params.count : _total;
        var _end = min(_start + _count, _total);

        var _values = [];
        for (var _i = _start; _i < _end; _i++) {
            array_push(_values, _arr[_i]);
        }

        return {
            instance_id: _inst,
            variable_name: _var_name,
            total_length: _total,
            start: _start,
            count: _end - _start,
            values: _values
        };
    });

    mcp_route("inspect_struct", function(_params) {
        // Bridge sends "variable", accept both "variable" and "variable_name"
        if (!variable_struct_exists(_params, "instance_id") ||
            (!variable_struct_exists(_params, "variable") && !variable_struct_exists(_params, "variable_name"))) {
            return { __error: "Missing required parameters: instance_id, variable", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _var_name = variable_struct_exists(_params, "variable") ? _params.variable : _params.variable_name;
        if (!variable_instance_exists(_inst, _var_name)) {
            return { __error: "Variable does not exist on instance: " + _var_name, __code: -32602 };
        }

        var _struct = variable_instance_get(_inst, _var_name);
        if (!is_struct(_struct)) {
            return { __error: "Variable is not a struct: " + _var_name, __code: -32602 };
        }

        var _names = variable_struct_get_names(_struct);
        var _entries = {};
        for (var _i = 0; _i < array_length(_names); _i++) {
            var _key = _names[_i];
            var _val = variable_struct_get(_struct, _key);
            variable_struct_set(_entries, _key, _val);
        }

        return {
            instance_id: _inst,
            variable_name: _var_name,
            field_count: array_length(_names),
            fields: _names,
            entries: _entries
        };
    });
}
