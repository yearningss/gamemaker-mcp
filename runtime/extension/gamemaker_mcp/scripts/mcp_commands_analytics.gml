/// @description MCP Commands - Analytics Event Logging

function mcp_register_commands_analytics() {

    mcp_route("start_event_log", function(_params) {
        if (!variable_global_exists("__mcp_event_log")) {
            global.__mcp_event_log = [];
        }
        if (!variable_global_exists("__mcp_session_start_time")) {
            global.__mcp_session_start_time = current_time;
        }
        global.__mcp_event_log_enabled = true;

        return {
            enabled: true
        };
    });

    mcp_route("clear_event_log", function(_params) {
        global.__mcp_event_log = [];

        return {
            cleared: true
        };
    });

    mcp_route("log_event", function(_params) {
        if (!variable_struct_exists(_params, "event_type") || _params.event_type == "") {
            return { __error: "event_type is required.", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_event_log_enabled") || !global.__mcp_event_log_enabled) {
            return { __error: "Event log is not enabled. Call start_event_log first.", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_event_log")) {
            global.__mcp_event_log = [];
        }

        var _entry = {
            type: _params.event_type,
            data: _params[$ "data"] ?? {},
            category: _params[$ "category"] ?? "",
            time: current_time,
            frame: variable_global_exists("__mcp_profiling_frame") ? global.__mcp_profiling_frame : 0
        };

        array_push(global.__mcp_event_log, _entry);

        return {
            logged: true,
            event_count: array_length(global.__mcp_event_log)
        };
    });

    mcp_route("get_event_log", function(_params) {
        if (!variable_global_exists("__mcp_event_log")) {
            global.__mcp_event_log = [];
        }

        var _log = global.__mcp_event_log;
        var _total = array_length(_log);
        var _filter_type = _params[$ "event_type"] ?? undefined;
        var _filter_cat = _params[$ "category"] ?? undefined;
        var _limit = _params[$ "limit"] ?? 100;

        var _filtered = [];

        for (var _i = 0; _i < _total; _i++) {
            var _entry = _log[_i];

            if (!is_undefined(_filter_type) && _entry.type != _filter_type) {
                continue;
            }
            if (!is_undefined(_filter_cat) && _entry.category != _filter_cat) {
                continue;
            }

            array_push(_filtered, _entry);

            if (array_length(_filtered) >= _limit) {
                break;
            }
        }

        return {
            events: _filtered,
            count: array_length(_filtered),
            total_in_log: _total
        };
    });

    mcp_route("get_play_session_stats", function(_params) {
        if (!variable_global_exists("__mcp_session_start_time")) {
            global.__mcp_session_start_time = current_time;
        }
        if (!variable_global_exists("__mcp_event_log")) {
            global.__mcp_event_log = [];
        }

        var _log = global.__mcp_event_log;
        var _total = array_length(_log);
        var _duration = current_time - global.__mcp_session_start_time;

        // Count events by type
        var _by_type = {};
        for (var _i = 0; _i < _total; _i++) {
            var _t = _log[_i].type;
            if (variable_struct_exists(_by_type, _t)) {
                _by_type[$ _t]++;
            } else {
                _by_type[$ _t] = 1;
            }
        }

        return {
            duration_ms: _duration,
            total_events: _total,
            events_by_type: _by_type,
            fps: fps,
            fps_real: fps_real
        };
    });

    mcp_route("generate_heatmap_data", function(_params) {
        if (!variable_global_exists("__mcp_event_log")) {
            global.__mcp_event_log = [];
        }

        var _log = global.__mcp_event_log;
        var _total = array_length(_log);
        var _filter_type = _params[$ "event_type"] ?? undefined;
        var _grid_size = _params[$ "grid_size"] ?? 32;
        var _rw = _params[$ "room_width"] ?? room_width;
        var _rh = _params[$ "room_height"] ?? room_height;

        // Use a ds_map keyed by "gx,gy" to accumulate counts
        var _map = ds_map_create();
        var _event_count = 0;

        for (var _i = 0; _i < _total; _i++) {
            var _entry = _log[_i];

            // Filter by type if specified
            if (!is_undefined(_filter_type) && _entry.type != _filter_type) {
                continue;
            }

            // Only include events that have x and y in their data
            var _d = _entry.data;
            if (!is_struct(_d)) continue;
            if (!variable_struct_exists(_d, "x") || !variable_struct_exists(_d, "y")) {
                continue;
            }

            var _gx = floor(_d.x / _grid_size);
            var _gy = floor(_d.y / _grid_size);
            var _key = string(_gx) + "," + string(_gy);

            if (ds_map_exists(_map, _key)) {
                _map[? _key]++;
            } else {
                _map[? _key] = 1;
            }

            _event_count++;
        }

        // Convert map to array of grid cells
        var _grid = [];
        var _key = ds_map_find_first(_map);
        while (!is_undefined(_key)) {
            var _parts = string_split(_key, ",");
            array_push(_grid, {
                x: real(_parts[0]) * _grid_size,
                y: real(_parts[1]) * _grid_size,
                count: _map[? _key]
            });
            _key = ds_map_find_next(_map, _key);
        }

        ds_map_destroy(_map);

        return {
            grid: _grid,
            grid_size: _grid_size,
            total_events: _event_count
        };
    });
}
