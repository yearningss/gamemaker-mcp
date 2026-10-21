/// @description MCP Commands - Project Info

function mcp_register_commands_project() {

    mcp_route("get_project_info", function(_params) {
        var _room_count = 0;
        try { _room_count = room_last + 1; } catch(_e) { _room_count = -1; }
        return {
            game_name: game_display_name,
            version: MCP_VERSION,
            gm_version: GM_version,
            gm_build: GM_build_date,
            room_count: _room_count,
            instance_count: instance_count,
            fps: game_get_speed(gamespeed_fps),
            os: os_type
        };
    });

    mcp_route("get_resource_tree", function(_params) {
        var _room_count = 0;
        try { _room_count = room_last + 1; } catch(_e) { _room_count = -1; }
        return {
            rooms: _room_count,
            note: "Full tree requires project file parsing"
        };
    });

    mcp_route("search_resources", function(_params) {
        if (!variable_struct_exists(_params, "query") || _params.query == "") {
            return { __error: "Missing required parameter: query", __code: -32602 };
        }

        var _query = string_lower(_params.query);
        var _matches = [];

        // Search room names
        try {
            for (var _i = 0; _i <= room_last; _i++) {
                var _name = room_get_name(_i);
                if (_name != "" && string_pos(_query, string_lower(_name)) > 0) {
                    array_push(_matches, {
                        type: "room",
                        name: _name,
                        index: _i
                    });
                }
            }
        } catch(_e) { /* room_last not available */ }

        return { query: _params.query, matches: _matches, match_count: array_length(_matches) };
    });

    mcp_route("get_room_order", function(_params) {
        var _rooms = [];
        try {
            for (var _i = 0; _i <= room_last; _i++) {
                var _name = room_get_name(_i);
                if (_name != "") {
                    array_push(_rooms, {
                        index: _i,
                        name: _name
                    });
                }
            }
        } catch(_e) { /* room_last not available */ }
        return { rooms: _rooms };
    });

    mcp_route("get_config_info", function(_params) {
        return {
            os_type: os_type,
            os_version: os_version,
            os_browser: os_browser,
            debug_mode: debug_mode,
            fps_target: game_get_speed(gamespeed_fps),
            display_width: display_get_width(),
            display_height: display_get_height()
        };
    });

    mcp_route("get_resource_count", function(_params) {
        var _room_count = 0;
        try { _room_count = room_last + 1; } catch(_e) { _room_count = -1; }
        return {
            rooms: _room_count,
            instances: instance_count
        };
    });

}
