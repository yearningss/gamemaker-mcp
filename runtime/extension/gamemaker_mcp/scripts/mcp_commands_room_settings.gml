/// @description MCP Commands - Room Settings

function mcp_register_commands_room_settings() {

    mcp_route("set_room_size", function(_params) {
        if (!variable_struct_exists(_params, "width") || !variable_struct_exists(_params, "height")) {
            return { __error: "Missing required parameters: width and height", __code: -32602 };
        }

        var _rm = variable_struct_exists(_params, "room_name") ? asset_get_index(_params.room_name) : room;
        if (_rm < 0) {
            return { __error: "Room not found: " + _params.room_name, __code: -32602 };
        }

        if (_rm == room) {
            room_width = _params.width;
            room_height = _params.height;
        } else {
            room_set_width(_rm, _params.width);
            room_set_height(_rm, _params.height);
        }

        return {
            room: room_get_name(_rm),
            width: _params.width,
            height: _params.height,
            success: true
        };
    });

    mcp_route("set_room_background_color", function(_params) {
        if (!variable_struct_exists(_params, "color")) {
            return { __error: "Missing required parameter: color", __code: -32602 };
        }

        var _color = _params.color;
        var _applied = false;
        var _layer_name = "";

        // In modern GameMaker, backgrounds are managed through layers
        // Find the first background layer and set its blend color
        var _layers = layer_get_all();
        var _count = array_length(_layers);

        for (var _i = 0; _i < _count; _i++) {
            var _elements = layer_get_all_elements(_layers[_i]);
            var _el_count = array_length(_elements);

            for (var _j = 0; _j < _el_count; _j++) {
                if (layer_get_element_type(_elements[_j]) == layerelementtype_background) {
                    layer_background_blend(_elements[_j], _color);
                    _applied = true;
                    _layer_name = layer_get_name(_layers[_i]);
                    break;
                }
            }
            if (_applied) break;
        }

        if (_applied) {
            return {
                color: _color,
                layer_name: _layer_name,
                success: true
            };
        } else {
            return {
                color: _color,
                success: false,
                note: "No background layer found in the current room. Add a background layer to apply the color."
            };
        }
    });

    mcp_route("get_room_physics", function(_params) {
        var _rm = variable_struct_exists(_params, "room_name") ? asset_get_index(_params.room_name) : room;
        if (_rm < 0) {
            return { __error: "Room not found: " + _params.room_name, __code: -32602 };
        }

        var _physics_enabled = physics_world_exists();
        var _result = {
            room: room_get_name(_rm),
            physics_enabled: _physics_enabled,
            gravity_x: _physics_enabled ? phy_world_gravity_x : 0,
            gravity_y: _physics_enabled ? phy_world_gravity_y : 0
        };

        return _result;
    });

    mcp_route("create_room_instance_batch", function(_params) {
        if (!variable_struct_exists(_params, "object_name")) {
            return { __error: "Missing required parameter: object_name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "positions")) {
            return { __error: "Missing required parameter: positions", __code: -32602 };
        }

        var _obj = asset_get_index(_params.object_name);
        if (_obj < 0) {
            return { __error: "Object not found: " + _params.object_name, __code: -32602 };
        }

        var _layer_name = variable_struct_exists(_params, "layer_name") ? _params.layer_name : undefined;
        var _layer_id;

        if (_layer_name != undefined) {
            _layer_id = layer_get_id(_layer_name);
            if (_layer_id == -1) {
                return { __error: "Layer not found: " + _layer_name, __code: -32602 };
            }
        } else {
            // Use the first available instance layer
            var _all_layers = layer_get_all();
            _layer_id = _all_layers[0];
        }

        var _positions = _params.positions;
        var _ids = [];
        var _count = array_length(_positions);

        for (var _i = 0; _i < _count; _i++) {
            var _pos = _positions[_i];
            var _inst = instance_create_layer(_pos.x, _pos.y, _layer_id, _obj);
            array_push(_ids, _inst);
        }

        return {
            object_name: _params.object_name,
            created: _ids,
            count: array_length(_ids),
            success: true
        };
    });

    mcp_route("set_room_speed", function(_params) {
        if (!variable_struct_exists(_params, "speed")) {
            return { __error: "Missing required parameter: speed", __code: -32602 };
        }

        game_set_speed(_params.speed, gamespeed_fps);

        return {
            speed: game_get_speed(gamespeed_fps),
            success: true
        };
    });

}
