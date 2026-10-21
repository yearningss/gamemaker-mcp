/// @description MCP Commands - Font Tools

function mcp_register_commands_font() {

    mcp_route("get_font_list", function(_params) {
        var _assets = mcp_get_assets_by_type(asset_font);
        return {
            fonts: _assets,
            count: array_length(_assets)
        };
    });

    mcp_route("get_font_info", function(_params) {
        if (!variable_struct_exists(_params, "font_name")) {
            return { __error: "Missing required parameter: font_name", __code: -32602 };
        }

        var _f = asset_get_index(_params.font_name);
        if (_f < 0) {
            return { __error: "Font not found: " + _params.font_name, __code: -32602 };
        }

        return {
            name: font_get_name(_f),
            size: font_get_size(_f),
            bold: font_get_bold(_f),
            italic: font_get_italic(_f),
            first: font_get_info(_f).first,
            last: font_get_info(_f).last
        };
    });

    mcp_route("get_text_dimensions", function(_params) {
        if (!variable_struct_exists(_params, "text")) {
            return { __error: "Missing required parameter: text", __code: -32602 };
        }

        // Optionally set font before measuring
        var _prev_font = draw_get_font();
        if (variable_struct_exists(_params, "font_name")) {
            var _f = asset_get_index(_params.font_name);
            if (_f < 0) {
                return { __error: "Font not found: " + _params.font_name, __code: -32602 };
            }
            draw_set_font(_f);
        }

        var _text = _params.text;
        var _w, _h;

        if (variable_struct_exists(_params, "width") && _params.width > 0) {
            var _sep = variable_struct_exists(_params, "sep") ? _params.sep : -1;
            var _max_w = _params.width;
            _w = string_width_ext(_text, _sep, _max_w);
            _h = string_height_ext(_text, _sep, _max_w);
        } else {
            _w = string_width(_text);
            _h = string_height(_text);
        }

        // Restore previous font
        draw_set_font(_prev_font);

        return {
            width: _w,
            height: _h,
            text: _text
        };
    });

    mcp_route("set_draw_font", function(_params) {
        if (!variable_struct_exists(_params, "font_name")) {
            return { __error: "Missing required parameter: font_name", __code: -32602 };
        }

        var _f = asset_get_index(_params.font_name);
        if (_f < 0) {
            return { __error: "Font not found: " + _params.font_name, __code: -32602 };
        }

        draw_set_font(_f);
        return {
            font_name: _params.font_name,
            success: true
        };
    });

    mcp_route("get_current_font", function(_params) {
        var _f = draw_get_font();
        return {
            font_index: _f,
            font_name: (_f >= 0 ? font_get_name(_f) : "default")
        };
    });

}
