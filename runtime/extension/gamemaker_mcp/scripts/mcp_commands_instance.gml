/// @description MCP Commands - Instance Management

function mcp_register_commands_instance() {

    mcp_route("get_all_instances", function(_params) {
        var _instances = [];
        with (all) {
            array_push(_instances, {
                id: id,
                object_name: object_get_name(object_index),
                x: x,
                y: y,
                sprite_index: sprite_index,
                visible: visible,
                depth: depth
            });
        }
        return { instances: _instances, count: array_length(_instances) };
    });

    mcp_route("get_instance_info", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        return {
            id: _inst,
            object_name: object_get_name(_inst.object_index),
            x: _inst.x,
            y: _inst.y,
            hspeed: _inst.hspeed,
            vspeed: _inst.vspeed,
            speed: _inst.speed,
            direction: _inst.direction,
            friction: _inst.friction,
            gravity: _inst.gravity,
            gravity_direction: _inst.gravity_direction,
            sprite_index: _inst.sprite_index,
            image_index: _inst.image_index,
            image_speed: _inst.image_speed,
            image_xscale: _inst.image_xscale,
            image_yscale: _inst.image_yscale,
            image_angle: _inst.image_angle,
            image_alpha: _inst.image_alpha,
            image_blend: _inst.image_blend,
            visible: _inst.visible,
            solid: _inst.solid,
            persistent: _inst.persistent,
            depth: _inst.depth,
            layer: _inst.layer,
            mask_index: _inst.mask_index,
            path_index: _inst.path_index,
            bbox_left: _inst.bbox_left,
            bbox_top: _inst.bbox_top,
            bbox_right: _inst.bbox_right,
            bbox_bottom: _inst.bbox_bottom
        };
    });

    mcp_route("find_instances_by_object", function(_params) {
        if (!variable_struct_exists(_params, "object_name")) {
            return { __error: "Missing required parameter: object_name", __code: -32602 };
        }

        var _obj = asset_get_index(_params.object_name);
        if (_obj < 0) {
            return { __error: "Object not found: " + _params.object_name, __code: -32602 };
        }

        var _count = instance_number(_obj);
        var _instances = [];
        for (var _i = 0; _i < _count; _i++) {
            var _inst = instance_find(_obj, _i);
            array_push(_instances, {
                id: _inst,
                x: _inst.x,
                y: _inst.y,
                visible: _inst.visible,
                depth: _inst.depth
            });
        }

        return { object_name: _params.object_name, instances: _instances, count: _count };
    });

    mcp_route("get_instance_variables", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _names = variable_instance_get_names(_inst);
        var _vars = {};
        for (var _i = 0; _i < array_length(_names); _i++) {
            var _val = variable_instance_get(_inst, _names[_i]);
            variable_struct_set(_vars, _names[_i], _val);
        }

        return { instance_id: _inst, variables: _vars, count: array_length(_names) };
    });

    mcp_route("set_instance_variable", function(_params) {
        if (!variable_struct_exists(_params, "instance_id") ||
            !variable_struct_exists(_params, "variable") ||
            !variable_struct_exists(_params, "value")) {
            return { __error: "Missing required parameters: instance_id, variable, value", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        variable_instance_set(_inst, _params.variable, _params.value);
        return {
            success: true,
            instance_id: _inst,
            variable: _params.variable,
            new_value: _params.value
        };
    });

    mcp_route("create_instance", function(_params) {
        if (!variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y") ||
            !variable_struct_exists(_params, "object_name")) {
            return { __error: "Missing required parameters: x, y, object_name", __code: -32602 };
        }

        var _obj = asset_get_index(_params.object_name);
        if (_obj < 0) {
            return { __error: "Object not found: " + _params.object_name, __code: -32602 };
        }

        var _layer_name = variable_struct_exists(_params, "layer") ? _params.layer : "Instances";
        var _inst = instance_create_layer(_params.x, _params.y, _layer_name, _obj);

        return {
            success: true,
            instance_id: _inst,
            object_name: _params.object_name,
            x: _params.x,
            y: _params.y,
            layer: _layer_name
        };
    });

    mcp_route("destroy_instance", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        instance_destroy(_inst);
        return { success: true, destroyed_id: _inst };
    });

    mcp_route("move_instance", function(_params) {
        if (!variable_struct_exists(_params, "instance_id") ||
            !variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: instance_id, x, y", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        _inst.x = _params.x;
        _inst.y = _params.y;
        return { success: true, instance_id: _inst, x: _params.x, y: _params.y };
    });

    mcp_route("get_instance_count", function(_params) {
        return { count: instance_count };
    });

    mcp_route("find_nearest_instance", function(_params) {
        if (!variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y") ||
            !variable_struct_exists(_params, "object_name")) {
            return { __error: "Missing required parameters: x, y, object_name", __code: -32602 };
        }

        var _obj = asset_get_index(_params.object_name);
        if (_obj < 0) {
            return { __error: "Object not found: " + _params.object_name, __code: -32602 };
        }

        var _inst = instance_nearest(_params.x, _params.y, _obj);
        if (_inst == noone) {
            return { found: false, note: "No instances of " + _params.object_name + " exist" };
        }

        return {
            found: true,
            instance_id: _inst,
            object_name: _params.object_name,
            x: _inst.x,
            y: _inst.y,
            distance: point_distance(_params.x, _params.y, _inst.x, _inst.y)
        };
    });

}
