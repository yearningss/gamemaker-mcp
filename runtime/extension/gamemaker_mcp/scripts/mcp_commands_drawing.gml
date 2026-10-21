/// @description MCP Commands - Drawing Tools

function mcp_register_commands_drawing() {

    // Initialize draw queue globals if not already set
    if (!variable_global_exists("__mcp_draw_queue")) {
        global.__mcp_draw_queue = [];
    }
    if (!variable_global_exists("__mcp_draw_persistent")) {
        global.__mcp_draw_persistent = [];
    }
    if (!variable_global_exists("__mcp_draw_color")) {
        global.__mcp_draw_color = c_white;
    }
    if (!variable_global_exists("__mcp_draw_alpha")) {
        global.__mcp_draw_alpha = 1.0;
    }

    mcp_route("draw_text_at", function(_params) {
        if (!variable_struct_exists(_params, "x") || !variable_struct_exists(_params, "y") || !variable_struct_exists(_params, "text")) {
            return { __error: "Missing required parameters: x, y, text", __code: -32602 };
        }

        var _persistent = _params[$ "persistent"] ?? false;
        var _cmd = {
            type: "text",
            x: _params.x,
            y: _params.y,
            text: _params.text,
            color: _params[$ "color"] ?? global.__mcp_draw_color,
            alpha: _params[$ "alpha"] ?? global.__mcp_draw_alpha,
            font_name: _params[$ "font_name"] ?? undefined
        };

        if (_persistent) {
            array_push(global.__mcp_draw_persistent, _cmd);
        } else {
            array_push(global.__mcp_draw_queue, _cmd);
        }

        return { queued: true, persistent: _persistent, type: "text" };
    });

    mcp_route("draw_rectangle_at", function(_params) {
        if (!variable_struct_exists(_params, "x1") || !variable_struct_exists(_params, "y1") ||
            !variable_struct_exists(_params, "x2") || !variable_struct_exists(_params, "y2")) {
            return { __error: "Missing required parameters: x1, y1, x2, y2", __code: -32602 };
        }

        var _persistent = _params[$ "persistent"] ?? false;
        var _cmd = {
            type: "rectangle",
            x1: _params.x1,
            y1: _params.y1,
            x2: _params.x2,
            y2: _params.y2,
            outline: _params[$ "outline"] ?? false,
            color: _params[$ "color"] ?? global.__mcp_draw_color,
            alpha: _params[$ "alpha"] ?? global.__mcp_draw_alpha
        };

        if (_persistent) {
            array_push(global.__mcp_draw_persistent, _cmd);
        } else {
            array_push(global.__mcp_draw_queue, _cmd);
        }

        return { queued: true, persistent: _persistent, type: "rectangle" };
    });

    mcp_route("draw_circle_at", function(_params) {
        if (!variable_struct_exists(_params, "x") || !variable_struct_exists(_params, "y") ||
            !variable_struct_exists(_params, "radius")) {
            return { __error: "Missing required parameters: x, y, radius", __code: -32602 };
        }

        var _persistent = _params[$ "persistent"] ?? false;
        var _cmd = {
            type: "circle",
            x: _params.x,
            y: _params.y,
            radius: _params.radius,
            outline: _params[$ "outline"] ?? false,
            color: _params[$ "color"] ?? global.__mcp_draw_color,
            alpha: _params[$ "alpha"] ?? global.__mcp_draw_alpha
        };

        if (_persistent) {
            array_push(global.__mcp_draw_persistent, _cmd);
        } else {
            array_push(global.__mcp_draw_queue, _cmd);
        }

        return { queued: true, persistent: _persistent, type: "circle" };
    });

    mcp_route("draw_line_at", function(_params) {
        if (!variable_struct_exists(_params, "x1") || !variable_struct_exists(_params, "y1") ||
            !variable_struct_exists(_params, "x2") || !variable_struct_exists(_params, "y2")) {
            return { __error: "Missing required parameters: x1, y1, x2, y2", __code: -32602 };
        }

        var _persistent = _params[$ "persistent"] ?? false;
        var _cmd = {
            type: "line",
            x1: _params.x1,
            y1: _params.y1,
            x2: _params.x2,
            y2: _params.y2,
            width: _params[$ "width"] ?? 1,
            color: _params[$ "color"] ?? global.__mcp_draw_color,
            alpha: _params[$ "alpha"] ?? global.__mcp_draw_alpha
        };

        if (_persistent) {
            array_push(global.__mcp_draw_persistent, _cmd);
        } else {
            array_push(global.__mcp_draw_queue, _cmd);
        }

        return { queued: true, persistent: _persistent, type: "line" };
    });

    mcp_route("draw_sprite_at", function(_params) {
        if (!variable_struct_exists(_params, "sprite_name") || !variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: sprite_name, x, y", __code: -32602 };
        }

        var _spr = asset_get_index(_params.sprite_name);
        if (_spr < 0) {
            return { __error: "Sprite not found: " + string(_params.sprite_name), __code: -32602 };
        }

        var _persistent = _params[$ "persistent"] ?? false;
        var _cmd = {
            type: "sprite",
            sprite: _spr,
            x: _params.x,
            y: _params.y,
            subimg: _params[$ "subimg"] ?? 0,
            xscale: _params[$ "xscale"] ?? 1,
            yscale: _params[$ "yscale"] ?? 1,
            rot: _params[$ "rot"] ?? 0,
            color: _params[$ "color"] ?? global.__mcp_draw_color,
            alpha: _params[$ "alpha"] ?? global.__mcp_draw_alpha
        };

        if (_persistent) {
            array_push(global.__mcp_draw_persistent, _cmd);
        } else {
            array_push(global.__mcp_draw_queue, _cmd);
        }

        return { queued: true, persistent: _persistent, type: "sprite" };
    });

    mcp_route("set_draw_color", function(_params) {
        if (!variable_struct_exists(_params, "color")) {
            return { __error: "Missing required parameter: color", __code: -32602 };
        }

        global.__mcp_draw_color = _params.color;

        return { color: _params.color, success: true };
    });

    mcp_route("set_draw_alpha", function(_params) {
        if (!variable_struct_exists(_params, "alpha")) {
            return { __error: "Missing required parameter: alpha", __code: -32602 };
        }

        global.__mcp_draw_alpha = _params.alpha;

        return { alpha: _params.alpha, success: true };
    });

    mcp_route("get_draw_color", function(_params) {
        return {
            color: draw_get_colour(),
            alpha: draw_get_alpha(),
            mcp_color: global.__mcp_draw_color,
            mcp_alpha: global.__mcp_draw_alpha
        };
    });

    mcp_route("set_blend_mode", function(_params) {
        if (!variable_struct_exists(_params, "mode")) {
            return { __error: "Missing required parameter: mode", __code: -32602 };
        }

        array_push(global.__mcp_draw_queue, {
            type: "blend_mode",
            mode: _params.mode
        });

        return { mode: _params.mode, queued: true };
    });

    mcp_route("clear_draw_queue", function(_params) {
        var _persistent_only = _params[$ "persistent_only"] ?? false;

        if (_persistent_only) {
            global.__mcp_draw_persistent = [];
        } else {
            global.__mcp_draw_queue = [];
            global.__mcp_draw_persistent = [];
        }

        return { cleared: true, persistent_only: _persistent_only };
    });
}
