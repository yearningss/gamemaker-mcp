/// @description MCP Server - TCP server management for GameMaker MCP Runtime

#macro MCP_ENABLED false
#macro :Debug MCP_ENABLED true

#macro MCP_PORT 6705
#macro MCP_MAX_CLIENTS 4
#macro MCP_BUFFER_SIZE 65536
#macro MCP_VERSION "1.0.0"

/// @function mcp_server_init()
/// @description Initialize the MCP TCP server
function mcp_server_init() {
    // Check environment variable for custom port
    var _port = MCP_PORT;
    var _env_port = environment_get_variable("GAMEMAKER_MCP_PORT");
    if (_env_port != "") {
        _port = real(_env_port);
    }

    global.__mcp_server = network_create_server_raw(network_socket_tcp, _port, MCP_MAX_CLIENTS);
    global.__mcp_clients = ds_map_create();
    global.__mcp_recv_buffers = ds_map_create();
    global.__mcp_port = _port;
    global.__mcp_debug_log = [];
    global.__mcp_screenshot_requested = false;
    global.__mcp_screenshot_type = "game";
    global.__mcp_screenshot_surface = -1;
    global.__mcp_screenshot_callback_id = -1;
    global.__mcp_screenshot_deferred_id = -1;
    global.__mcp_screenshot_deferred_socket = -1;
    global.__mcp_paused = false;
    global.__mcp_profiling = false;
    global.__mcp_profiling_data = {};
    global.__mcp_profiling_frame = 0;
    global.__mcp_watched_variables = [];
    global.__mcp_recording = false;
    global.__mcp_recording_frames = [];
    global.__mcp_input_sim = {
        keys_pressed: {},
        mouse_buttons: {},
        mouse_x: 0,
        mouse_y: 0,
        mouse_wheel: 0,
        gamepad: {}
    };
    global.__mcp_camera_shake = { active: false, intensity: 0, duration: 0, offset_x: 0, offset_y: 0 };

    // Draw Queue for Drawing/Shader tools
    global.__mcp_draw_queue = [];
    global.__mcp_draw_persistent = [];
    global.__mcp_draw_color = c_white;
    global.__mcp_draw_alpha = 1.0;

    // State machine tracking
    global.__mcp_state_machines = {};

    // Analytics event log
    global.__mcp_event_log = [];
    global.__mcp_event_log_enabled = false;
    global.__mcp_session_start_time = current_time;

    // Test framework results
    global.__mcp_test_results = [];

    // Buffer tracking
    global.__mcp_tracked_buffers = {};
    global.__mcp_tracked_buffer_next_id = 0;

    // Audio emitter tracking
    global.__mcp_tracked_emitters = {};
    global.__mcp_tracked_emitter_next_id = 0;

    // Path tracking
    global.__mcp_tracked_paths = {};
    global.__mcp_tracked_mp_grids = {};

    // Variable history tracking
    global.__mcp_variable_tracking_enabled = false;
    global.__mcp_variable_history = {};

    if (global.__mcp_server < 0) {
        show_debug_message("[MCP] Failed to create server on port " + string(_port));
        return false;
    }

    show_debug_message("[MCP] Server started on port " + string(_port) + " (v" + MCP_VERSION + ")");
    mcp_router_init();
    return true;
}

/// @function mcp_server_shutdown()
/// @description Shutdown the MCP server
function mcp_server_shutdown() {
    // Disconnect all clients
    var _key = ds_map_find_first(global.__mcp_clients);
    while (!is_undefined(_key)) {
        network_destroy(global.__mcp_clients[? _key]);
        _key = ds_map_find_next(global.__mcp_clients, _key);
    }
    ds_map_destroy(global.__mcp_clients);
    ds_map_destroy(global.__mcp_recv_buffers);

    if (global.__mcp_server >= 0) {
        network_destroy(global.__mcp_server);
        global.__mcp_server = -1;
    }

    show_debug_message("[MCP] Server shut down");
}

/// @function mcp_server_handle_network(async_load)
/// @description Handle network events from Async Networking
function mcp_server_handle_network() {
    var _type = async_load[? "type"];
    var _sock = async_load[? "socket"];
    var _id = async_load[? "id"];

    switch (_type) {
        case network_type_connect:
            ds_map_add(global.__mcp_clients, string(_sock), _sock);
            ds_map_add(global.__mcp_recv_buffers, string(_sock), "");
            show_debug_message("[MCP] Client connected: " + string(_sock));
            break;

        case network_type_disconnect:
            ds_map_delete(global.__mcp_clients, string(_sock));
            ds_map_delete(global.__mcp_recv_buffers, string(_sock));
            show_debug_message("[MCP] Client disconnected: " + string(_sock));
            break;

        case network_type_data:
            var _buffer = async_load[? "buffer"];
            var _size = async_load[? "size"];
            var _client_sock = async_load[? "id"]; // For data events, client socket is in "id"

            // Read raw bytes from buffer (raw server has no null terminator)
            var _data = "";
            if (_size > 0) {
                var _temp = buffer_create(_size + 1, buffer_fixed, 1);
                buffer_copy(_buffer, 0, _size, _temp, 0);
                buffer_poke(_temp, _size, buffer_u8, 0);
                buffer_seek(_temp, buffer_seek_start, 0);
                _data = buffer_read(_temp, buffer_text);
                buffer_delete(_temp);
            }

            // Append to receive buffer for this client
            var _key = string(_client_sock);
            var _recv = ds_map_find_value(global.__mcp_recv_buffers, _key);
            if (is_undefined(_recv)) _recv = "";
            _recv += _data;

            // Process complete JSON-RPC messages (newline-delimited)
            var _newline_pos = string_pos("\n", _recv);
            while (_newline_pos > 0) {
                var _line = string_copy(_recv, 1, _newline_pos - 1);
                _recv = string_delete(_recv, 1, _newline_pos);

                if (string_length(_line) > 0) {
                    mcp_server_process_message(_client_sock, _line);
                }

                _newline_pos = string_pos("\n", _recv);
            }

            ds_map_set(global.__mcp_recv_buffers, _key, _recv);
            break;
    }
}

/// @function mcp_server_process_message(socket, message)
/// @description Parse and execute a JSON-RPC 2.0 request
function mcp_server_process_message(_socket, _message) {
    var _request, _response;

    try {
        _request = json_parse(_message);
    } catch (_err) {
        _response = mcp_jsonrpc_error(-1, -32700, "Parse error");
        mcp_server_send(_socket, _response);
        return;
    }

    // Validate JSON-RPC 2.0
    if (!is_struct(_request) || _request[$ "jsonrpc"] != "2.0") {
        _response = mcp_jsonrpc_error(_request[$ "id"] ?? -1, -32600, "Invalid request");
        mcp_server_send(_socket, _response);
        return;
    }

    var _id = _request[$ "id"] ?? -1;
    var _method = _request[$ "method"] ?? "";
    var _params = _request[$ "params"] ?? {};

    // Route the command
    var _result = mcp_router_execute(_method, _params);

    // Check for deferred response (e.g. screenshot captured at end of draw cycle)
    if (is_struct(_result) && variable_struct_exists(_result, "__deferred")) {
        // Response will be sent later; store socket and request ID
        global.__mcp_screenshot_deferred_id = _id;
        global.__mcp_screenshot_deferred_socket = _socket;
        return;
    }

    if (is_struct(_result) && variable_struct_exists(_result, "__error")) {
        _response = mcp_jsonrpc_error(_id, _result.__code ?? -32603, _result.__error);
    } else {
        _response = mcp_jsonrpc_result(_id, _result);
    }

    mcp_server_send(_socket, _response);
}

/// @function mcp_server_send(socket, data)
/// @description Send a JSON-RPC response to a client
function mcp_server_send(_socket, _data) {
    var _json = json_stringify(_data) + "\n";
    var _buff = buffer_create(string_byte_length(_json) + 1, buffer_fixed, 1);
    buffer_write(_buff, buffer_text, _json);
    network_send_raw(_socket, _buff, buffer_get_size(_buff));
    buffer_delete(_buff);
}

/// @function mcp_jsonrpc_result(id, result)
function mcp_jsonrpc_result(_id, _result) {
    return {
        jsonrpc: "2.0",
        id: _id,
        result: _result
    };
}

/// @function mcp_jsonrpc_error(id, code, message)
function mcp_jsonrpc_error(_id, _code, _message) {
    return {
        jsonrpc: "2.0",
        id: _id,
        error: {
            code: _code,
            message: _message
        }
    };
}

/// @function mcp_log(message)
/// @description Add a message to the debug log
function mcp_log(_message) {
    array_push(global.__mcp_debug_log, {
        time: current_time,
        message: _message
    });
    // Keep log at max 500 entries
    if (array_length(global.__mcp_debug_log) > 500) {
        array_delete(global.__mcp_debug_log, 0, 1);
    }
}
