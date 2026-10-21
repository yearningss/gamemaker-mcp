/// @description MCP Commands - Surface Tools

function mcp_register_commands_surface() {

    // Track MCP-created surfaces
    if (!variable_global_exists("__mcp_surfaces")) {
        global.__mcp_surfaces = [];
    }

    mcp_route("list_surfaces", function(_params) {
        var _surfaces = [];
        var _tracked = global.__mcp_surfaces;
        var _clean = [];

        for (var _i = 0; _i < array_length(_tracked); _i++) {
            var _sid = _tracked[_i];
            if (surface_exists(_sid)) {
                array_push(_surfaces, {
                    surface_id: _sid,
                    width: surface_get_width(_sid),
                    height: surface_get_height(_sid),
                    estimated_bytes: surface_get_width(_sid) * surface_get_height(_sid) * 4
                });
                array_push(_clean, _sid);
            }
        }

        // Clean up freed surfaces from tracking
        global.__mcp_surfaces = _clean;

        // Also report application_surface
        if (surface_exists(application_surface)) {
            var _w = surface_get_width(application_surface);
            var _h = surface_get_height(application_surface);
            array_push(_surfaces, {
                surface_id: application_surface,
                name: "application_surface",
                width: _w,
                height: _h,
                estimated_bytes: _w * _h * 4
            });
        }

        return {
            surfaces: _surfaces,
            count: array_length(_surfaces),
            note: "Tracks surfaces created through MCP and the application_surface."
        };
    });

    mcp_route("get_surface_info", function(_params) {
        if (!variable_struct_exists(_params, "surface_id")) {
            return { __error: "Missing required parameter: surface_id", __code: -32602 };
        }

        var _sid = _params.surface_id;
        var _exists = surface_exists(_sid);

        if (!_exists) {
            return {
                surface_id: _sid,
                exists: false
            };
        }

        return {
            surface_id: _sid,
            exists: true,
            width: surface_get_width(_sid),
            height: surface_get_height(_sid),
            estimated_bytes: surface_get_width(_sid) * surface_get_height(_sid) * 4
        };
    });

    mcp_route("create_surface", function(_params) {
        if (!variable_struct_exists(_params, "width") ||
            !variable_struct_exists(_params, "height")) {
            return { __error: "Missing required parameters: width, height", __code: -32602 };
        }

        var _w = _params.width;
        var _h = _params.height;
        var _sid = surface_create(_w, _h);

        array_push(global.__mcp_surfaces, _sid);

        return {
            surface_id: _sid,
            width: _w,
            height: _h,
            success: true
        };
    });

    mcp_route("free_surface", function(_params) {
        if (!variable_struct_exists(_params, "surface_id")) {
            return { __error: "Missing required parameter: surface_id", __code: -32602 };
        }

        var _sid = _params.surface_id;

        if (!surface_exists(_sid)) {
            return { __error: "Surface does not exist: " + string(_sid), __code: -32602 };
        }

        surface_free(_sid);

        // Remove from tracking
        var _new = [];
        for (var _i = 0; _i < array_length(global.__mcp_surfaces); _i++) {
            if (global.__mcp_surfaces[_i] != _sid) {
                array_push(_new, global.__mcp_surfaces[_i]);
            }
        }
        global.__mcp_surfaces = _new;

        return {
            surface_id: _sid,
            freed: true,
            success: true
        };
    });

    mcp_route("capture_surface", function(_params) {
        if (!variable_struct_exists(_params, "surface_id")) {
            return { __error: "Missing required parameter: surface_id", __code: -32602 };
        }

        var _sid = _params.surface_id;

        if (!surface_exists(_sid)) {
            return { __error: "Surface does not exist: " + string(_sid), __code: -32602 };
        }

        // Use deferred screenshot mechanism
        global.__mcp_screenshot_requested = true;
        global.__mcp_screenshot_type = "surface";
        global.__mcp_screenshot_surface = _sid;

        return { __deferred: true };
    });

}
