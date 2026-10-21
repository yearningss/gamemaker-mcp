/// @description MCP Utilities - Shared helper functions

/// @function mcp_get_assets_by_type(_type)
/// @description Get all assets of a given type (asset_font, asset_path, asset_shader, etc.)
/// @param {Constant.AssetType} _type The asset type constant
/// @returns {Array<Struct>} Array of {index, name} structs
function mcp_get_assets_by_type(_type) {
    var _assets = [];
    var _tag = tag_get_asset_ids("", _type);

    // tag_get_asset_ids with empty string returns all assets of that type
    // Fallback: iterate by index if tag system doesn't return results
    if (array_length(_tag) > 0) {
        for (var _i = 0; _i < array_length(_tag); _i++) {
            var _id = _tag[_i];
            var _name = "";
            switch (_type) {
                case asset_font:      _name = font_get_name(_id); break;
                case asset_path:      _name = path_get_name(_id); break;
                case asset_shader:    _name = shader_get_name(_id); break;
                case asset_timeline:  _name = timeline_get_name(_id); break;
                case asset_sprite:    _name = sprite_get_name(_id); break;
                case asset_object:    _name = object_get_name(_id); break;
                case asset_room:      _name = room_get_name(_id); break;
                case asset_sound:     _name = audio_get_name(_id); break;
                case asset_sequence:  _name = sequence_get(_id).name; break;
                default:              _name = string(_id); break;
            }
            array_push(_assets, { index: _id, name: _name });
        }
    }

    return _assets;
}

/// @function mcp_draw_execute(_cmd)
/// @description Execute a single draw queue command
function mcp_draw_execute(_cmd) {
    var _type = _cmd[$ "type"];
    switch (_type) {
        case "text":
            draw_set_colour(_cmd[$ "color"] ?? global.__mcp_draw_color);
            draw_set_alpha(_cmd[$ "alpha"] ?? global.__mcp_draw_alpha);
            draw_set_font(_cmd[$ "font"] ?? -1);
            draw_text(_cmd.x, _cmd.y, _cmd.text);
            break;
        case "rectangle":
            draw_set_colour(_cmd[$ "color"] ?? global.__mcp_draw_color);
            draw_set_alpha(_cmd[$ "alpha"] ?? global.__mcp_draw_alpha);
            draw_rectangle(_cmd.x1, _cmd.y1, _cmd.x2, _cmd.y2, _cmd[$ "outline"] ?? false);
            break;
        case "circle":
            draw_set_colour(_cmd[$ "color"] ?? global.__mcp_draw_color);
            draw_set_alpha(_cmd[$ "alpha"] ?? global.__mcp_draw_alpha);
            draw_circle(_cmd.x, _cmd.y, _cmd.radius, _cmd[$ "outline"] ?? false);
            break;
        case "line":
            draw_set_colour(_cmd[$ "color"] ?? global.__mcp_draw_color);
            draw_set_alpha(_cmd[$ "alpha"] ?? global.__mcp_draw_alpha);
            draw_line_width(_cmd.x1, _cmd.y1, _cmd.x2, _cmd.y2, _cmd[$ "width"] ?? 1);
            break;
        case "sprite":
            draw_sprite_ext(
                _cmd.sprite, _cmd[$ "subimg"] ?? 0,
                _cmd.x, _cmd.y,
                _cmd[$ "xscale"] ?? 1, _cmd[$ "yscale"] ?? 1,
                _cmd[$ "rot"] ?? 0,
                _cmd[$ "color"] ?? c_white,
                _cmd[$ "alpha"] ?? global.__mcp_draw_alpha
            );
            break;
        case "set_shader":
            var _sh = asset_get_index(_cmd.shader);
            if (_sh >= 0 && shader_is_compiled(_sh)) {
                shader_set(_sh);
                // Apply uniforms if provided
                var _uniforms = _cmd[$ "uniforms"];
                if (is_struct(_uniforms)) {
                    var _names = variable_struct_get_names(_uniforms);
                    for (var _i = 0; _i < array_length(_names); _i++) {
                        var _uname = _names[_i];
                        var _handle = shader_get_uniform(_sh, _uname);
                        if (_handle >= 0) {
                            var _val = _uniforms[$ _uname];
                            if (is_array(_val)) {
                                switch (array_length(_val)) {
                                    case 1: shader_set_uniform_f(_handle, _val[0]); break;
                                    case 2: shader_set_uniform_f(_handle, _val[0], _val[1]); break;
                                    case 3: shader_set_uniform_f(_handle, _val[0], _val[1], _val[2]); break;
                                    case 4: shader_set_uniform_f(_handle, _val[0], _val[1], _val[2], _val[3]); break;
                                }
                            } else {
                                shader_set_uniform_f(_handle, _val);
                            }
                        }
                    }
                }
            }
            break;
        case "reset_shader":
            shader_reset();
            break;
        case "blend_mode":
            gpu_set_blendmode(_cmd[$ "mode"] ?? bm_normal);
            break;
    }
}
