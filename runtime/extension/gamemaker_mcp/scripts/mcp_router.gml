/// @description MCP Router - Command routing and dispatch

/// @function mcp_router_init()
/// @description Initialize the command router with all handlers
function mcp_router_init() {
    global.__mcp_routes = {};

    // Ping/Pong for heartbeat
    mcp_route("ping", function(_params) { return { pong: true, time: current_time }; });

    // Register all command categories
    mcp_register_commands_instance();
    mcp_register_commands_room();
    mcp_register_commands_variable();
    mcp_register_commands_debug();
    mcp_register_commands_project();
    mcp_register_commands_input();
    mcp_register_commands_screenshot();
    mcp_register_commands_audio();
    mcp_register_commands_layer();
    mcp_register_commands_tilemap();
    mcp_register_commands_camera();
    mcp_register_commands_particle();
    mcp_register_commands_physics();
    mcp_register_commands_ds();
    mcp_register_commands_game();
    mcp_register_commands_alarm();
    mcp_register_commands_animation();
    mcp_register_commands_collision();
    mcp_register_commands_profiling();

    // New command categories (Phase 1-4)
    mcp_register_commands_random();
    mcp_register_commands_filesystem();
    mcp_register_commands_path();
    mcp_register_commands_state_debug();
    mcp_register_commands_shader();
    mcp_register_commands_font();
    mcp_register_commands_audio_extended();
    mcp_register_commands_timeline();
    mcp_register_commands_drawing();
    mcp_register_commands_buffer();
    mcp_register_commands_test();
    mcp_register_commands_gc_memory();
    mcp_register_commands_room_settings();
    mcp_register_commands_analytics();
    mcp_register_commands_variable_history();
    mcp_register_commands_skeleton();
    mcp_register_commands_surface();

    show_debug_message("[MCP] Router initialized with " + string(variable_struct_names_count(global.__mcp_routes)) + " routes");
}

/// @function mcp_route(method, handler)
/// @description Register a route handler
function mcp_route(_method, _handler) {
    global.__mcp_routes[$ _method] = _handler;
}

/// @function mcp_router_execute(method, params)
/// @description Execute a routed command
function mcp_router_execute(_method, _params) {
    var _handler = global.__mcp_routes[$ _method];

    if (is_undefined(_handler)) {
        return { __error: "Method not found: " + _method, __code: -32601 };
    }

    try {
        return _handler(_params);
    } catch (_err) {
        mcp_log("Error in " + _method + ": " + string(_err));
        return { __error: "Internal error: " + string(_err), __code: -32603 };
    }
}
