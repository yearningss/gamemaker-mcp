/// @description MCP Commands - Variable Access

function mcp_register_commands_variable() {

    mcp_route("get_global_variables", function(_params) {
        var _result = [];
        try {
            var _names = variable_struct_get_names(global);
            for (var _i = 0; _i < array_length(_names); _i++) {
                var _name = _names[_i];
                if (string_pos("__mcp_", _name) == 1) continue;
                var _entry = { name: _name };
                try {
                    var _val = variable_struct_get(global, _name);
                    _entry.value = string(_val);
                } catch(_e2) {
                    _entry.value = "(unreadable)";
                }
                array_push(_result, _entry);
            }
        } catch(_e) {
            return { variables: [], count: 0, error: string(_e) };
        }
        return { variables: _result, count: array_length(_result) };
    });

    mcp_route("set_global_variable", function(_params) {
        if (!variable_struct_exists(_params, "variable") ||
            !variable_struct_exists(_params, "value")) {
            return { __error: "Missing required parameters: variable, value", __code: -32602 };
        }

        variable_global_set(_params.variable, _params.value);
        return {
            success: true,
            variable: _params.variable,
            new_value: _params.value
        };
    });

    mcp_route("get_instance_variable_value", function(_params) {
        if (!variable_struct_exists(_params, "instance_id") ||
            !variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameters: instance_id, variable", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _val = variable_instance_get(_inst, _params.variable);
        return {
            instance_id: _inst,
            variable: _params.variable,
            value: _val,
            type: typeof(_val)
        };
    });

    mcp_route("set_instance_variable_value", function(_params) {
        if (!variable_struct_exists(_params, "instance_id") ||
            !variable_struct_exists(_params, "variable") ||
            !variable_struct_exists(_params, "value")) {
            return { __error: "Missing required parameters: instance_id, variable, value", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        variable_instance_set(_inst, _params.variable, _params.value);
        return {
            success: true,
            instance_id: _inst,
            variable: _params.variable,
            new_value: _params.value
        };
    });

    mcp_route("get_built_in_variables", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _alarms = [];
        for (var _i = 0; _i < 12; _i++) {
            array_push(_alarms, _inst.alarm[_i]);
        }

        return {
            instance_id: _inst,
            x: _inst.x,
            y: _inst.y,
            speed: _inst.speed,
            direction: _inst.direction,
            hspeed: _inst.hspeed,
            vspeed: _inst.vspeed,
            friction: _inst.friction,
            gravity: _inst.gravity,
            gravity_direction: _inst.gravity_direction,
            image_index: _inst.image_index,
            image_speed: _inst.image_speed,
            sprite_index: _inst.sprite_index,
            visible: _inst.visible,
            depth: _inst.depth,
            solid: _inst.solid,
            persistent: _inst.persistent,
            path_index: _inst.path_index,
            alarms: _alarms
        };
    });

    mcp_route("evaluate_expression", function(_params) {
        if (!variable_struct_exists(_params, "expression")) {
            return { __error: "Missing required parameter: expression", __code: -32602 };
        }

        // GML does not support dynamic eval at runtime.
        // We can handle a limited set of simple expressions.
        var _expr = _params.expression;

        // Handle simple known expressions
        if (_expr == "instance_count") return { result: instance_count };
        if (_expr == "fps") return { result: fps };
        if (_expr == "fps_real") return { result: fps_real };
        if (_expr == "room") return { result: room_get_name(room) };
        if (_expr == "room_width") return { result: room_width };
        if (_expr == "room_height") return { result: room_height };
        if (_expr == "current_time") return { result: current_time };
        if (_expr == "delta_time") return { result: delta_time };

        return {
            note: "Dynamic expression evaluation is not supported in compiled GML. Only predefined expressions are available: instance_count, fps, fps_real, room, room_width, room_height, current_time, delta_time",
            expression: _expr
        };
    });

    mcp_route("watch_variable", function(_params) {
        if (!variable_struct_exists(_params, "instance_id") ||
            !variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameters: instance_id, variable", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_watched_variables")) {
            global.__mcp_watched_variables = [];
        }

        var _watch = {
            instance_id: _params.instance_id,
            variable: _params.variable,
            last_value: variable_instance_get(_params.instance_id, _params.variable),
            added_at: current_time
        };

        array_push(global.__mcp_watched_variables, _watch);

        return {
            success: true,
            watching: _params.variable,
            instance_id: _params.instance_id,
            total_watched: array_length(global.__mcp_watched_variables)
        };
    });

    mcp_route("get_variable_type", function(_params) {
        if (!variable_struct_exists(_params, "instance_id") ||
            !variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameters: instance_id, variable", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _val = variable_instance_get(_inst, _params.variable);
        return {
            instance_id: _inst,
            variable: _params.variable,
            type: typeof(_val),
            value: _val
        };
    });

}
