/// @description MCP Commands - Debug Tools

function mcp_register_commands_debug() {

    mcp_route("get_fps", function(_params) {
        return {
            fps: fps,
            fps_real: fps_real
        };
    });

    mcp_route("get_memory_usage", function(_params) {
        return {
            note: "Detailed memory profiling is limited in GML runtime",
            debug_mode: debug_mode,
            instance_count: instance_count,
            current_time: current_time
        };
    });

    mcp_route("get_draw_calls", function(_params) {
        return {
            note: "Draw call count is not directly accessible via GML runtime API. Use the built-in GameMaker profiler for draw call analysis.",
            debug_mode: debug_mode
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

    mcp_route("execute_gml", function(_params) {
        // Bridge sends "code", accept both "code" and "command" for compatibility
        var _cmd = "";
        if (variable_struct_exists(_params, "code")) _cmd = _params.code;
        else if (variable_struct_exists(_params, "command")) _cmd = _params.command;
        else {
            return { __error: "Missing required parameter: code", __code: -32602 };
        }

        // Handle a limited set of predefined safe commands
        if (_cmd == "game_restart") {
            game_restart();
            return { success: true, command: _cmd };
        }
        if (_cmd == "room_restart") {
            room_restart();
            return { success: true, command: _cmd };
        }
        if (_cmd == "show_debug_message") {
            var _msg = variable_struct_exists(_params, "message") ? _params.message : "MCP debug";
            show_debug_message(_msg);
            return { success: true, command: _cmd, message: _msg };
        }
        if (_cmd == "instance_count") {
            return { success: true, command: _cmd, result: instance_count };
        }
        if (_cmd == "fps") {
            return { success: true, command: _cmd, result: fps };
        }

        return {
            note: "Dynamic GML execution is not supported at runtime. Only predefined commands are available: game_restart, room_restart, show_debug_message, instance_count, fps",
            command: _cmd
        };
    });

}
