/// @description MCP Commands - Variable History Tracking

function mcp_register_commands_variable_history() {

    mcp_route("enable_variable_tracking", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameter: variable", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _var = _params.variable;
        if (!variable_instance_exists(_inst, _var)) {
            return { __error: "Variable '" + _var + "' does not exist on instance " + string(_inst), __code: -32602 };
        }

        var _key = string(_params.instance_id) + ":" + _var;
        var _val = variable_instance_get(_inst, _var);

        if (!variable_global_exists("__mcp_variable_history")) {
            global.__mcp_variable_history = {};
        }

        global.__mcp_variable_history[$ _key] = {
            instance_id: _params.instance_id,
            variable: _var,
            initial_value: _val,
            last_value: _val,
            change_count: 0,
            history: [{ value: _val, frame: 0, time: current_time }],
            max_samples: _params[$ "max_samples"] ?? 300,
            frame_count: 0
        };

        global.__mcp_variable_tracking_enabled = true;

        return {
            tracking: true,
            instance_id: _params.instance_id,
            variable: _var,
            initial_value: _val
        };
    });

    mcp_route("disable_variable_tracking", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameter: variable", __code: -32602 };
        }

        var _key = string(_params.instance_id) + ":" + _params.variable;

        if (!variable_global_exists("__mcp_variable_history") || !variable_struct_exists(global.__mcp_variable_history, _key)) {
            return { __error: "Variable is not being tracked: " + _key, __code: -32602 };
        }

        variable_struct_remove(global.__mcp_variable_history, _key);

        if (variable_struct_names_count(global.__mcp_variable_history) == 0) {
            global.__mcp_variable_tracking_enabled = false;
        }

        return {
            tracking: false,
            instance_id: _params.instance_id,
            variable: _params.variable
        };
    });

    mcp_route("get_variable_history", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameter: variable", __code: -32602 };
        }

        var _key = string(_params.instance_id) + ":" + _params.variable;

        if (!variable_global_exists("__mcp_variable_history") || !variable_struct_exists(global.__mcp_variable_history, _key)) {
            return { __error: "Variable is not being tracked: " + _key, __code: -32602 };
        }

        var _data = global.__mcp_variable_history[$ _key];
        var _limit = _params[$ "limit"] ?? 50;
        var _history = _data.history;
        var _count = array_length(_history);

        var _result = [];
        var _start = max(0, _count - _limit);
        for (var _i = _start; _i < _count; _i++) {
            array_push(_result, _history[_i]);
        }

        return {
            instance_id: _params.instance_id,
            variable: _params.variable,
            history: _result,
            count: array_length(_result)
        };
    });

    mcp_route("get_variable_change_count", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameter: variable", __code: -32602 };
        }

        var _key = string(_params.instance_id) + ":" + _params.variable;

        if (!variable_global_exists("__mcp_variable_history") || !variable_struct_exists(global.__mcp_variable_history, _key)) {
            return { __error: "Variable is not being tracked: " + _key, __code: -32602 };
        }

        var _data = global.__mcp_variable_history[$ _key];

        return {
            instance_id: _params.instance_id,
            variable: _params.variable,
            change_count: _data.change_count
        };
    });

    mcp_route("diff_variable_snapshots", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameter: variable", __code: -32602 };
        }

        var _key = string(_params.instance_id) + ":" + _params.variable;

        if (!variable_global_exists("__mcp_variable_history") || !variable_struct_exists(global.__mcp_variable_history, _key)) {
            return { __error: "Variable is not being tracked: " + _key, __code: -32602 };
        }

        var _data = global.__mcp_variable_history[$ _key];
        var _current = _data.last_value;

        return {
            instance_id: _params.instance_id,
            variable: _params.variable,
            initial_value: _data.initial_value,
            current_value: _current,
            changed: (_data.initial_value != _current),
            change_count: _data.change_count
        };
    });

    mcp_route("get_all_tracked_variables", function(_params) {
        var _tracked = [];

        if (variable_global_exists("__mcp_variable_history")) {
            var _keys = variable_struct_get_names(global.__mcp_variable_history);
            var _count = array_length(_keys);

            for (var _i = 0; _i < _count; _i++) {
                var _data = global.__mcp_variable_history[$ _keys[_i]];
                array_push(_tracked, {
                    instance_id: _data.instance_id,
                    variable: _data.variable,
                    change_count: _data.change_count,
                    current_value: _data.last_value
                });
            }
        }

        return {
            tracked: _tracked,
            count: array_length(_tracked)
        };
    });
}
