/// @description MCP Commands - Timeline & Sequence Tools

function mcp_register_commands_timeline() {

    mcp_route("get_timeline_list", function(_params) {
        var _assets = mcp_get_assets_by_type(asset_timeline);
        return {
            timelines: _assets,
            count: array_length(_assets)
        };
    });

    mcp_route("get_timeline_info", function(_params) {
        if (!variable_struct_exists(_params, "timeline_name")) {
            return { __error: "Missing required parameter: timeline_name", __code: -32602 };
        }

        var _tl = asset_get_index(_params.timeline_name);
        if (_tl < 0) {
            return { __error: "Timeline not found: " + _params.timeline_name, __code: -32602 };
        }

        return {
            name: _params.timeline_name,
            index: _tl,
            size: timeline_size(_tl)
        };
    });

    mcp_route("set_instance_timeline", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "timeline_name")) {
            return { __error: "Missing required parameter: timeline_name", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _tl = asset_get_index(_params.timeline_name);
        if (_tl < 0) {
            return { __error: "Timeline not found: " + _params.timeline_name, __code: -32602 };
        }

        with (_inst) {
            timeline_index = _tl;

            if (variable_struct_exists(_params, "position")) {
                timeline_position = _params.position;
            }
            if (variable_struct_exists(_params, "speed")) {
                timeline_speed = _params.speed;
            }
            if (variable_struct_exists(_params, "loop")) {
                timeline_loop = _params.loop;
            }
            if (variable_struct_exists(_params, "running")) {
                timeline_running = _params.running;
            }
        }

        return {
            instance_id: _inst,
            timeline_name: _params.timeline_name,
            success: true
        };
    });

    mcp_route("get_sequence_list", function(_params) {
        var _assets = mcp_get_assets_by_type(asset_sequence);
        return {
            sequences: _assets,
            count: array_length(_assets)
        };
    });

    mcp_route("get_sequence_info", function(_params) {
        if (!variable_struct_exists(_params, "sequence_name")) {
            return { __error: "Missing required parameter: sequence_name", __code: -32602 };
        }

        var _seq_id = asset_get_index(_params.sequence_name);
        if (_seq_id < 0) {
            return { __error: "Sequence not found: " + _params.sequence_name, __code: -32602 };
        }

        try {
            var _seq = sequence_get(_seq_id);
            return {
                name: _seq.name,
                length: _seq.length,
                xorigin: _seq.xorigin,
                yorigin: _seq.yorigin,
                playbackSpeed: _seq.playbackSpeed,
                playbackSpeedType: _seq.playbackSpeedType
            };
        } catch (_err) {
            return { __error: "Failed to get sequence info: " + string(_err), __code: -32603 };
        }
    });

    mcp_route("play_sequence", function(_params) {
        if (!variable_struct_exists(_params, "sequence_name")) {
            return { __error: "Missing required parameter: sequence_name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "x")) {
            return { __error: "Missing required parameter: x", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameter: y", __code: -32602 };
        }

        var _seq_id = asset_get_index(_params.sequence_name);
        if (_seq_id < 0) {
            return { __error: "Sequence not found: " + _params.sequence_name, __code: -32602 };
        }

        try {
            var _layer;
            if (_params[$ "layer_name"] != undefined) {
                _layer = layer_get_id(_params.layer_name);
            } else {
                var _all_layers = layer_get_all();
                _layer = array_length(_all_layers) > 0 ? _all_layers[0] : -1;
            }

            if (_layer == -1) {
                return { __error: "Layer not found", __code: -32602 };
            }

            var _elem = layer_sequence_create(_layer, _params.x, _params.y, _seq_id);
            return {
                element_id: _elem,
                sequence_name: _params.sequence_name,
                x: _params.x,
                y: _params.y,
                success: true
            };
        } catch (_err) {
            return { __error: "Failed to play sequence: " + string(_err), __code: -32603 };
        }
    });

    mcp_route("stop_sequence", function(_params) {
        if (!variable_struct_exists(_params, "element_id")) {
            return { __error: "Missing required parameter: element_id", __code: -32602 };
        }

        try {
            layer_sequence_destroy(_params.element_id);
            return {
                element_id: _params.element_id,
                stopped: true
            };
        } catch (_err) {
            return { __error: "Failed to stop sequence: " + string(_err), __code: -32603 };
        }
    });
}
