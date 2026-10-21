/// @description MCP Commands - Game State Control

function mcp_register_commands_game() {

    mcp_route("pause_game", function(_params) {
        global.__mcp_paused = true;

        // Deactivate all instances except the MCP server
        instance_deactivate_all(true);
        if (object_exists(obj_mcp_server)) {
            instance_activate_object(obj_mcp_server);
        }

        return {
            paused: true,
            note: "Game paused. All instances deactivated except obj_mcp_server."
        };
    });

    mcp_route("resume_game", function(_params) {
        instance_activate_all();
        global.__mcp_paused = false;

        return {
            paused: false,
            note: "Game resumed. All instances reactivated."
        };
    });

    mcp_route("set_game_speed", function(_params) {
        if (!variable_struct_exists(_params, "speed")) {
            return { __error: "Missing required parameter: speed", __code: -32602 };
        }

        var _old_speed = game_get_speed(gamespeed_fps);
        game_set_speed(_params.speed, gamespeed_fps);

        return {
            old_speed: _old_speed,
            new_speed: _params.speed,
            success: true
        };
    });

    mcp_route("restart_game", function(_params) {
        // Send the response first, then restart on next frame
        global.__mcp_pending_restart = true;

        return {
            restarting: true,
            note: "Game will restart on the next frame. Connection may be lost briefly."
        };
    });

    mcp_route("get_game_state", function(_params) {
        var _paused = false;
        if (variable_global_exists("__mcp_paused")) {
            _paused = global.__mcp_paused;
        }

        return {
            paused: _paused,
            room: room_get_name(room),
            room_index: room,
            fps: fps,
            fps_real: fps_real,
            instance_count: instance_count,
            game_speed: game_get_speed(gamespeed_fps),
            current_time: current_time,
            delta_time: delta_time
        };
    });

    mcp_route("step_frame", function(_params) {
        var _paused = false;
        if (variable_global_exists("__mcp_paused")) {
            _paused = global.__mcp_paused;
        }

        if (!_paused) {
            return { __error: "Game is not paused. Use pause_game first to enable frame stepping.", __code: -32602 };
        }

        // Temporarily reactivate all instances for one frame
        instance_activate_all();
        global.__mcp_step_frame = true;

        // The MCP server Step event should check for global.__mcp_step_frame
        // and re-pause after one frame:
        //   if (global.__mcp_step_frame) {
        //       global.__mcp_step_frame = false;
        //       instance_deactivate_all(true);
        //       instance_activate_object(obj_mcp_server);
        //   }

        return {
            stepped: true,
            note: "One frame will execute. Ensure obj_mcp_server End Step re-pauses by checking global.__mcp_step_frame."
        };
    });
}
