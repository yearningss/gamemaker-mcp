/// @description MCP Commands - Alarm Management

function mcp_register_commands_alarm() {

    mcp_route("get_alarms", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _alarms = {};
        with (_inst) {
            for (var _i = 0; _i < 12; _i++) {
                _alarms[$ "alarm_" + string(_i)] = alarm[_i];
            }
        }

        return {
            instance_id: _inst,
            object_name: object_get_name(_inst.object_index),
            alarms: _alarms
        };
    });

    mcp_route("set_alarm", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "alarm_index")) {
            return { __error: "Missing required parameter: alarm_index", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "value")) {
            return { __error: "Missing required parameter: value", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _index = _params.alarm_index;
        if (_index < 0 || _index > 11) {
            return { __error: "Alarm index must be between 0 and 11", __code: -32602 };
        }

        with (_inst) {
            alarm[_index] = _params.value;
        }

        return {
            instance_id: _inst,
            alarm_index: _index,
            value: _params.value,
            success: true
        };
    });

    mcp_route("get_all_alarms", function(_params) {
        var _results = [];

        with (all) {
            var _has_active = false;
            var _alarm_data = {};

            for (var _i = 0; _i < 12; _i++) {
                if (alarm[_i] > -1) {
                    _alarm_data[$ "alarm_" + string(_i)] = alarm[_i];
                    _has_active = true;
                }
            }

            if (_has_active) {
                array_push(_results, {
                    instance_id: id,
                    object_name: object_get_name(object_index),
                    active_alarms: _alarm_data
                });
            }
        }

        return {
            instances_with_alarms: _results,
            count: array_length(_results)
        };
    });

    mcp_route("cancel_alarm", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "alarm_index")) {
            return { __error: "Missing required parameter: alarm_index", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _index = _params.alarm_index;
        if (_index < 0 || _index > 11) {
            return { __error: "Alarm index must be between 0 and 11", __code: -32602 };
        }

        var _old_value;
        with (_inst) {
            _old_value = alarm[_index];
            alarm[_index] = -1;
        }

        return {
            instance_id: _inst,
            alarm_index: _index,
            previous_value: _old_value,
            cancelled: true,
            success: true
        };
    });
}
