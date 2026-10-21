/// @description MCP Commands - Debug Tools

function mcp_register_commands_debug() {

    mcp_route("get_fps", function(_params) {
        return {
            fps: fps,
            fps_real: fps_real
        };
    });

    mcp_route("get_step_time", function(_params) {
        return {
            delta_time: delta_time,
            delta_seconds: delta_time / 1000000,
            current_time: current_time,
            fps: fps,
            fps_real: fps_real,
            target_fps: game_get_speed(gamespeed_fps)
        };
    });

    mcp_route("show_debug_overlay", function(_params) {
        if (!variable_struct_exists(_params, "visible")) {
            return { __error: "Missing required parameter: visible", __code: -32602 };
        }

        show_debug_overlay(_params.visible);
        return { success: true, visible: _params.visible };
    });

    mcp_route("get_error_log", function(_params) {
        if (!variable_global_exists("__mcp_debug_log")) {
            global.__mcp_debug_log = [];
        }

        // Bridge sends "count", accept both "count" and "limit" for compatibility
        var _limit = 50;
        if (variable_struct_exists(_params, "count")) _limit = _params.count;
        else if (variable_struct_exists(_params, "limit")) _limit = _params.limit;
        var _log = global.__mcp_debug_log;
        var _count = array_length(_log);

        // Return the most recent entries up to the limit
        var _start = max(0, _count - _limit);
        var _entries = [];
        for (var _i = _start; _i < _count; _i++) {
            array_push(_entries, _log[_i]);
        }

        return {
            entries: _entries,
            total_count: _count,
            returned_count: array_length(_entries)
        };
    });

}
