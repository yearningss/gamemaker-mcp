/// @description MCP Commands - Collision Detection

function mcp_register_commands_collision() {

    mcp_route("check_collision_point", function(_params) {
        if (!variable_struct_exists(_params, "x") || !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: x, y", __code: -32602 };
        }

        var _obj = all;
        if (variable_struct_exists(_params, "object_name")) {
            _obj = asset_get_index(_params.object_name);
            if (_obj < 0) {
                return { __error: "Object not found: " + _params.object_name, __code: -32602 };
            }
        }

        var _prec = variable_struct_exists(_params, "precise") ? _params.precise : false;
        var _not_me = variable_struct_exists(_params, "not_me") ? _params.not_me : true;

        var _hit = collision_point(_params.x, _params.y, _obj, _prec, _not_me);

        if (_hit != noone) {
            return {
                x: _params.x,
                y: _params.y,
                collision: true,
                instance_id: _hit,
                object_name: object_get_name(_hit.object_index),
                instance_x: _hit.x,
                instance_y: _hit.y
            };
        }

        return {
            x: _params.x,
            y: _params.y,
            collision: false,
            instance_id: noone
        };
    });

    mcp_route("check_collision_rectangle", function(_params) {
        if (!variable_struct_exists(_params, "x1") || !variable_struct_exists(_params, "y1")
            || !variable_struct_exists(_params, "x2") || !variable_struct_exists(_params, "y2")) {
            return { __error: "Missing required parameters: x1, y1, x2, y2", __code: -32602 };
        }

        var _obj = all;
        if (variable_struct_exists(_params, "object_name")) {
            _obj = asset_get_index(_params.object_name);
            if (_obj < 0) {
                return { __error: "Object not found: " + _params.object_name, __code: -32602 };
            }
        }

        var _prec = variable_struct_exists(_params, "precise") ? _params.precise : false;
        var _not_me = variable_struct_exists(_params, "not_me") ? _params.not_me : true;

        var _hit = collision_rectangle(_params.x1, _params.y1, _params.x2, _params.y2, _obj, _prec, _not_me);

        if (_hit != noone) {
            return {
                x1: _params.x1,
                y1: _params.y1,
                x2: _params.x2,
                y2: _params.y2,
                collision: true,
                instance_id: _hit,
                object_name: object_get_name(_hit.object_index),
                instance_x: _hit.x,
                instance_y: _hit.y
            };
        }

        return {
            x1: _params.x1,
            y1: _params.y1,
            x2: _params.x2,
            y2: _params.y2,
            collision: false,
            instance_id: noone
        };
    });

    mcp_route("check_collision_line", function(_params) {
        if (!variable_struct_exists(_params, "x1") || !variable_struct_exists(_params, "y1")
            || !variable_struct_exists(_params, "x2") || !variable_struct_exists(_params, "y2")) {
            return { __error: "Missing required parameters: x1, y1, x2, y2", __code: -32602 };
        }

        var _obj = all;
        if (variable_struct_exists(_params, "object_name")) {
            _obj = asset_get_index(_params.object_name);
            if (_obj < 0) {
                return { __error: "Object not found: " + _params.object_name, __code: -32602 };
            }
        }

        var _prec = variable_struct_exists(_params, "precise") ? _params.precise : false;
        var _not_me = variable_struct_exists(_params, "not_me") ? _params.not_me : true;

        var _hit = collision_line(_params.x1, _params.y1, _params.x2, _params.y2, _obj, _prec, _not_me);

        if (_hit != noone) {
            return {
                x1: _params.x1,
                y1: _params.y1,
                x2: _params.x2,
                y2: _params.y2,
                collision: true,
                instance_id: _hit,
                object_name: object_get_name(_hit.object_index),
                instance_x: _hit.x,
                instance_y: _hit.y
            };
        }

        return {
            x1: _params.x1,
            y1: _params.y1,
            x2: _params.x2,
            y2: _params.y2,
            collision: false,
            instance_id: noone
        };
    });

    mcp_route("get_collision_mask", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _result = {};
        with (_inst) {
            _result.instance_id = id;
            _result.object_name = object_get_name(object_index);
            _result.bbox_left = bbox_left;
            _result.bbox_right = bbox_right;
            _result.bbox_top = bbox_top;
            _result.bbox_bottom = bbox_bottom;
            _result.bbox_width = bbox_right - bbox_left;
            _result.bbox_height = bbox_bottom - bbox_top;
            _result.mask_index = mask_index;
            _result.mask_name = mask_index >= 0 ? sprite_get_name(mask_index) : "none";
        }

        return _result;
    });

    mcp_route("find_collisions", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _collisions = [];

        // Check collision with all other instances using the instance's bounding box
        var _check_objects = [];
        if (variable_struct_exists(_params, "object_names") && is_array(_params.object_names)) {
            _check_objects = _params.object_names;
        }

        if (array_length(_check_objects) > 0) {
            // Check specific objects
            for (var _i = 0; _i < array_length(_check_objects); _i++) {
                var _obj = asset_get_index(_check_objects[_i]);
                if (_obj >= 0) {
                    with (_inst) {
                        var _hit = instance_place(x, y, _obj);
                        if (_hit != noone && _hit != id) {
                            array_push(_collisions, {
                                instance_id: _hit,
                                object_name: object_get_name(_hit.object_index),
                                x: _hit.x,
                                y: _hit.y
                            });
                        }
                    }
                }
            }
        } else {
            // Check against all instances using bounding box overlap
            with (all) {
                if (id != _inst && place_meeting(x, y, _inst)) {
                    array_push(_collisions, {
                        instance_id: id,
                        object_name: object_get_name(object_index),
                        x: x,
                        y: y
                    });
                }
            }
        }

        return {
            instance_id: _inst,
            collision_count: array_length(_collisions),
            collisions: _collisions
        };
    });
}
