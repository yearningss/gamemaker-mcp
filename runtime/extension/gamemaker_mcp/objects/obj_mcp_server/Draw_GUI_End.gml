/// @description Screenshot capture + Draw Queue processing
if (!MCP_ENABLED) exit;

// Process Draw Queue (one-shot items)
var _queue = global.__mcp_draw_queue;
for (var _i = 0; _i < array_length(_queue); _i++) {
    mcp_draw_execute(_queue[_i]);
}
global.__mcp_draw_queue = [];

// Process persistent draw items (re-drawn every frame)
var _persist = global.__mcp_draw_persistent;
for (var _i = 0; _i < array_length(_persist); _i++) {
    mcp_draw_execute(_persist[_i]);
}

if (global.__mcp_screenshot_requested) {
    var _w = surface_get_width(application_surface);
    var _h = surface_get_height(application_surface);
    var _surf = application_surface;

    if (global.__mcp_screenshot_type == "gui") {
        _w = display_get_gui_width();
        _h = display_get_gui_height();
    } else if (global.__mcp_screenshot_type == "surface" && global.__mcp_screenshot_surface >= 0) {
        _surf = global.__mcp_screenshot_surface;
        if (surface_exists(_surf)) {
            _w = surface_get_width(_surf);
            _h = surface_get_height(_surf);
        }
    }

    // Create a temporary surface to capture
    var _capture = surface_create(_w, _h);
    surface_set_target(_capture);
    draw_clear_alpha(c_black, 0);
    if (surface_exists(_surf)) {
        draw_surface(_surf, 0, 0);
    }
    surface_reset_target();

    // Save surface as PNG, then read as base64
    var _tmp_path = "mcp_screenshot_tmp.png";
    surface_save(_capture, _tmp_path);
    surface_free(_capture);

    // Read the PNG file into a buffer and base64-encode it
    var _base64 = "";
    if (file_exists(_tmp_path)) {
        var _buff = buffer_load(_tmp_path);
        _base64 = buffer_base64_encode(_buff, 0, buffer_get_size(_buff));
        buffer_delete(_buff);
        file_delete(_tmp_path);
    }

    // Send the deferred response back to the waiting client
    var _deferred_id = global.__mcp_screenshot_deferred_id;
    var _deferred_socket = global.__mcp_screenshot_deferred_socket;

    if (_deferred_id >= 0 && _deferred_socket >= 0) {
        var _response_data = {
            image: _base64,
            width: _w,
            height: _h
        };
        var _response = mcp_jsonrpc_result(_deferred_id, _response_data);
        mcp_server_send(_deferred_socket, _response);
    }

    global.__mcp_screenshot_requested = false;
    global.__mcp_screenshot_deferred_id = -1;
    global.__mcp_screenshot_deferred_socket = -1;

    // Handle recording
    if (global.__mcp_recording) {
        array_push(global.__mcp_recording_frames, {
            frame: array_length(global.__mcp_recording_frames),
            time: current_time,
            data: _base64,
            width: _w,
            height: _h
        });
    }
}
