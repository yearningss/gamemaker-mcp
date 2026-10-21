/// @description MCP Commands - State Debug Tools

function mcp_register_commands_state_debug() {

    mcp_route("register_state_machine", function(_params) {
        if (!variable_struct_exists(_params, "name")) {
            return { __error: "Missing required parameter: name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "initial_state")) {
            return { __error: "Missing required parameter: initial_state", __code: -32602 };
        }

        var _name = _params.name;
        var _initial = _params.initial_state;
        var _states = variable_struct_exists(_params, "states") ? _params.states : [];

        global.__mcp_state_machines[$ _name] = {
            current_state: _initial,
            states: _states,
            history: [
                {
                    state: _initial,
                    time: current_time,
                    frame: 0
                }
            ],
            registered_time: current_time
        };

        return {
            name: _name,
            initial_state: _initial,
            success: true
        };
    });

    mcp_route("set_fsm_state", function(_params) {
        if (!variable_struct_exists(_params, "name")) {
            return { __error: "Missing required parameter: name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "state")) {
            return { __error: "Missing required parameter: state", __code: -32602 };
        }

        var _name = _params.name;
        var _state = _params.state;

        if (!variable_struct_exists(global.__mcp_state_machines, _name)) {
            return { __error: "State machine not found: " + _name, __code: -32602 };
        }

        var _machine = global.__mcp_state_machines[$ _name];
        var _previous = _machine.current_state;
        _machine.current_state = _state;

        array_push(_machine.history, {
            from: _previous,
            to: _state,
            time: current_time
        });

        return {
            name: _name,
            previous_state: _previous,
            new_state: _state,
            success: true
        };
    });

    mcp_route("get_fsm_state", function(_params) {
        if (!variable_struct_exists(_params, "name")) {
            return { __error: "Missing required parameter: name", __code: -32602 };
        }

        var _name = _params.name;

        if (!variable_struct_exists(global.__mcp_state_machines, _name)) {
            return { __error: "State machine not found: " + _name, __code: -32602 };
        }

        var _machine = global.__mcp_state_machines[$ _name];
        var _history = _machine.history;
        var _history_count = array_length(_history);
        var _last_entry = _history[_history_count - 1];
        var _last_time = _last_entry.time;
        var _duration_ms = current_time - _last_time;

        return {
            name: _name,
            current_state: _machine.current_state,
            duration_ms: _duration_ms,
            history_count: _history_count
        };
    });

    mcp_route("get_state_history", function(_params) {
        if (!variable_struct_exists(_params, "name")) {
            return { __error: "Missing required parameter: name", __code: -32602 };
        }

        var _name = _params.name;

        if (!variable_struct_exists(global.__mcp_state_machines, _name)) {
            return { __error: "State machine not found: " + _name, __code: -32602 };
        }

        var _machine = global.__mcp_state_machines[$ _name];
        var _limit = variable_struct_exists(_params, "limit") ? _params.limit : 20;
        var _history = _machine.history;
        var _count = array_length(_history);
        var _start = max(0, _count - _limit);
        var _entries = [];

        for (var _i = _start; _i < _count; _i++) {
            array_push(_entries, _history[_i]);
        }

        return {
            name: _name,
            history: _entries,
            count: array_length(_entries)
        };
    });

    mcp_route("get_all_state_machines", function(_params) {
        var _machines = [];
        var _names = variable_struct_get_names(global.__mcp_state_machines);
        var _total = array_length(_names);

        for (var _i = 0; _i < _total; _i++) {
            var _name = _names[_i];
            var _machine = global.__mcp_state_machines[$ _name];
            array_push(_machines, {
                name: _name,
                current_state: _machine.current_state,
                transitions_count: array_length(_machine.history)
            });
        }

        return {
            machines: _machines,
            count: _total
        };
    });

    mcp_route("log_state_change", function(_params) {
        if (!variable_struct_exists(_params, "name")) {
            return { __error: "Missing required parameter: name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "from_state")) {
            return { __error: "Missing required parameter: from_state", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "to_state")) {
            return { __error: "Missing required parameter: to_state", __code: -32602 };
        }

        var _name = _params.name;
        var _from = _params.from_state;
        var _to = _params.to_state;
        var _trigger = variable_struct_exists(_params, "trigger") ? _params.trigger : undefined;

        // Auto-create FSM entry if it doesn't exist
        if (!variable_struct_exists(global.__mcp_state_machines, _name)) {
            global.__mcp_state_machines[$ _name] = {
                current_state: _from,
                states: [],
                history: [
                    {
                        state: _from,
                        time: current_time,
                        frame: 0
                    }
                ],
                registered_time: current_time
            };
        }

        var _machine = global.__mcp_state_machines[$ _name];

        var _entry = {
            from: _from,
            to: _to,
            time: current_time
        };

        if (!is_undefined(_trigger)) {
            _entry.trigger = _trigger;
        }

        array_push(_machine.history, _entry);
        _machine.current_state = _to;

        var _result = {
            name: _name,
            from_state: _from,
            to_state: _to,
            logged: true
        };

        if (!is_undefined(_trigger)) {
            _result.trigger = _trigger;
        }

        return _result;
    });

}
