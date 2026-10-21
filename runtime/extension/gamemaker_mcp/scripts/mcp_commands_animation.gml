/// @description MCP Commands - Animation & Sprite Control

function mcp_register_commands_animation() {

    mcp_route("get_sprite_info", function(_params) {
        var _spr = -1;

        // Accept either sprite_name or instance_id
        if (variable_struct_exists(_params, "sprite_name")) {
            _spr = asset_get_index(_params.sprite_name);
            if (_spr < 0 || asset_get_type(_params.sprite_name) != asset_sprite) {
                return { __error: "Sprite not found: " + _params.sprite_name, __code: -32602 };
            }
        } else if (variable_struct_exists(_params, "instance_id")) {
            var _inst = _params.instance_id;
            if (!instance_exists(_inst)) {
                return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
            }
            _spr = _inst.sprite_index;
            if (_spr < 0) {
                return {
                    instance_id: _inst,
                    sprite_index: -1,
                    note: "Instance has no sprite assigned."
                };
            }
        } else {
            return { __error: "Missing parameter: provide sprite_name or instance_id", __code: -32602 };
        }

        var _result = {
            sprite_index: _spr,
            sprite_name: sprite_get_name(_spr),
            frame_count: sprite_get_number(_spr),
            width: sprite_get_width(_spr),
            height: sprite_get_height(_spr),
            xoffset: sprite_get_xoffset(_spr),
            yoffset: sprite_get_yoffset(_spr),
            speed: sprite_get_speed(_spr)
        };

        if (variable_struct_exists(_params, "instance_id")) {
            _result.instance_id = _params.instance_id;
        }

        return _result;
    });

    mcp_route("set_sprite_index", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "sprite_name")) {
            return { __error: "Missing required parameter: sprite_name", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _spr = asset_get_index(_params.sprite_name);
        if (_spr < 0) {
            return { __error: "Sprite not found: " + _params.sprite_name, __code: -32602 };
        }

        var _old_sprite = _inst.sprite_index;
        _inst.sprite_index = _spr;

        return {
            instance_id: _inst,
            old_sprite: _old_sprite >= 0 ? sprite_get_name(_old_sprite) : "none",
            new_sprite: _params.sprite_name,
            success: true
        };
    });

    mcp_route("set_image_index", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "frame")) {
            return { __error: "Missing required parameter: frame", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        _inst.image_index = _params.frame;

        return {
            instance_id: _inst,
            image_index: _params.frame,
            success: true
        };
    });

    mcp_route("set_image_speed", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "speed")) {
            return { __error: "Missing required parameter: speed", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _old_speed = _inst.image_speed;
        _inst.image_speed = _params.speed;

        return {
            instance_id: _inst,
            old_speed: _old_speed,
            new_speed: _params.speed,
            success: true
        };
    });

    mcp_route("get_animation_state", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _spr = _inst.sprite_index;

        return {
            instance_id: _inst,
            sprite_index: _spr,
            sprite_name: _spr >= 0 ? sprite_get_name(_spr) : "none",
            image_index: _inst.image_index,
            image_speed: _inst.image_speed,
            image_number: _inst.image_number
        };
    });

    mcp_route("set_image_properties", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _changes = {};

        // Bridge sends "blend"/"alpha"/"xscale"/"yscale"/"angle", accept both prefixed and unprefixed
        with (_inst) {
            if (variable_struct_exists(_params, "blend") || variable_struct_exists(_params, "image_blend")) {
                var _color = variable_struct_exists(_params, "blend") ? _params.blend : _params.image_blend;
                if (is_string(_color)) {
                    var _hex = string_delete(_color, 1, 1);
                    var _r = real("0x" + string_copy(_hex, 1, 2));
                    var _g = real("0x" + string_copy(_hex, 3, 2));
                    var _b = real("0x" + string_copy(_hex, 5, 2));
                    image_blend = make_colour_rgb(_r, _g, _b);
                } else {
                    image_blend = _color;
                }
                _changes.image_blend = image_blend;
            }
            if (variable_struct_exists(_params, "alpha") || variable_struct_exists(_params, "image_alpha")) {
                var _a = variable_struct_exists(_params, "alpha") ? _params.alpha : _params.image_alpha;
                image_alpha = _a;
                _changes.image_alpha = _a;
            }
            if (variable_struct_exists(_params, "xscale") || variable_struct_exists(_params, "image_xscale")) {
                var _xs = variable_struct_exists(_params, "xscale") ? _params.xscale : _params.image_xscale;
                image_xscale = _xs;
                _changes.image_xscale = _xs;
            }
            if (variable_struct_exists(_params, "yscale") || variable_struct_exists(_params, "image_yscale")) {
                var _ys = variable_struct_exists(_params, "yscale") ? _params.yscale : _params.image_yscale;
                image_yscale = _ys;
                _changes.image_yscale = _ys;
            }
            if (variable_struct_exists(_params, "angle") || variable_struct_exists(_params, "image_angle")) {
                var _ang = variable_struct_exists(_params, "angle") ? _params.angle : _params.image_angle;
                image_angle = _ang;
                _changes.image_angle = _ang;
            }
        }

        return {
            instance_id: _inst,
            changes: _changes,
            success: true
        };
    });
}
