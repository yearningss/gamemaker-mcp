/// @description MCP Commands - Screenshot & Recording

function mcp_register_commands_screenshot() {

    mcp_route("get_game_screenshot", function(_params) {
        global.__mcp_screenshot_requested = true;
        global.__mcp_screenshot_type = "game";

        // Signal deferred response — actual data sent from Draw_GUI_End
        return { __deferred: true };
    });

    mcp_route("get_gui_screenshot", function(_params) {
        global.__mcp_screenshot_requested = true;
        global.__mcp_screenshot_type = "gui";

        // Signal deferred response — actual data sent from Draw_GUI_End
        return { __deferred: true };
    });

    mcp_route("get_surface_screenshot", function(_params) {
        if (!variable_struct_exists(_params, "surface_id")) {
            return { __error: "Missing required parameter: surface_id", __code: -32602 };
        }

        if (!surface_exists(_params.surface_id)) {
            return { __error: "Surface does not exist: " + string(_params.surface_id), __code: -32602 };
        }

        global.__mcp_screenshot_requested = true;
        global.__mcp_screenshot_type = "surface";
        global.__mcp_screenshot_surface = _params.surface_id;

        // Signal deferred response — actual data sent from Draw_GUI_End
        return { __deferred: true };
    });

    mcp_route("compare_screenshots", function(_params) {
        if (!variable_struct_exists(_params, "file_a") ||
            !variable_struct_exists(_params, "file_b")) {
            return { __error: "Missing required parameters: file_a, file_b", __code: -32602 };
        }

        // Check if files exist
        if (!file_exists(_params.file_a)) {
            return { __error: "File not found: " + _params.file_a, __code: -32602 };
        }
        if (!file_exists(_params.file_b)) {
            return { __error: "File not found: " + _params.file_b, __code: -32602 };
        }

        return {
            file_a: _params.file_a,
            file_b: _params.file_b,
            note: "Pixel-level screenshot comparison requires loading both images as sprites and comparing pixel data. This is a heavy operation. Consider using surface-based comparison for real-time use."
        };
    });

    mcp_route("start_recording", function(_params) {
        if (!variable_global_exists("__mcp_recording")) {
            global.__mcp_recording = false;
            global.__mcp_recording_frames = [];
            global.__mcp_recording_start = 0;
        }

        if (global.__mcp_recording) {
            return { __error: "Recording is already in progress", __code: -32602 };
        }

        global.__mcp_recording = true;
        global.__mcp_recording_frames = [];
        global.__mcp_recording_start = current_time;

        return {
            success: true,
            status: "recording",
            started_at: global.__mcp_recording_start
        };
    });

    mcp_route("stop_recording", function(_params) {
        if (!variable_global_exists("__mcp_recording") || !global.__mcp_recording) {
            return { __error: "No recording in progress", __code: -32602 };
        }

        global.__mcp_recording = false;
        var _frame_count = array_length(global.__mcp_recording_frames);
        var _duration = current_time - global.__mcp_recording_start;

        return {
            success: true,
            status: "stopped",
            frame_count: _frame_count,
            duration_ms: _duration,
            started_at: global.__mcp_recording_start,
            stopped_at: current_time
        };
    });

}
