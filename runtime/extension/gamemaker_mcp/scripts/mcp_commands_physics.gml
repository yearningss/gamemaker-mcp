/// @description MCP Commands - Physics World

function mcp_register_commands_physics() {

    mcp_route("get_physics_info", function(_params) {
        var _result = {
            enabled: false,
            gravity_x: 0,
            gravity_y: 0,
            pixels_to_meters: 0
        };

        try {
            // Attempt to read physics world variables; will throw if physics is not enabled
            _result.gravity_x = phy_world_gravity_x;
            _result.gravity_y = phy_world_gravity_y;
            _result.pixels_to_meters = phy_pixels_to_meters;
            _result.enabled = true;
        } catch (_ex) {
            _result.enabled = false;
            _result.note = "Physics is not enabled for this room. Enable it in Room Properties.";
        }

        return _result;
    });

    mcp_route("apply_force", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "fx") || !variable_struct_exists(_params, "fy")) {
            return { __error: "Missing required parameters: fx, fy", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        // Bridge sends x_offset/y_offset, accept both
        var _ox = 0;
        if (variable_struct_exists(_params, "x_offset")) _ox = _params.x_offset;
        else if (variable_struct_exists(_params, "offset_x")) _ox = _params.offset_x;
        var _oy = 0;
        if (variable_struct_exists(_params, "y_offset")) _oy = _params.y_offset;
        else if (variable_struct_exists(_params, "offset_y")) _oy = _params.offset_y;

        try {
            with (_inst) {
                physics_apply_force(_ox, _oy, _params.fx, _params.fy);
            }
        } catch (_ex) {
            return { __error: "Failed to apply force. Is physics enabled? " + string(_ex), __code: -32602 };
        }

        return {
            instance_id: _inst,
            offset_x: _ox,
            offset_y: _oy,
            fx: _params.fx,
            fy: _params.fy,
            success: true
        };
    });

    mcp_route("apply_impulse", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "fx") || !variable_struct_exists(_params, "fy")) {
            return { __error: "Missing required parameters: fx, fy", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        // Bridge sends x_offset/y_offset, accept both
        var _ox = 0;
        if (variable_struct_exists(_params, "x_offset")) _ox = _params.x_offset;
        else if (variable_struct_exists(_params, "offset_x")) _ox = _params.offset_x;
        var _oy = 0;
        if (variable_struct_exists(_params, "y_offset")) _oy = _params.y_offset;
        else if (variable_struct_exists(_params, "offset_y")) _oy = _params.offset_y;

        try {
            with (_inst) {
                physics_apply_impulse(_ox, _oy, _params.fx, _params.fy);
            }
        } catch (_ex) {
            return { __error: "Failed to apply impulse. Is physics enabled? " + string(_ex), __code: -32602 };
        }

        return {
            instance_id: _inst,
            offset_x: _ox,
            offset_y: _oy,
            fx: _params.fx,
            fy: _params.fy,
            success: true
        };
    });

    mcp_route("set_physics_properties", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _changes = {};

        try {
            with (_inst) {
                if (variable_struct_exists(_params, "density")) {
                    phy_density = _params.density;
                    _changes.density = _params.density;
                }
                if (variable_struct_exists(_params, "friction")) {
                    phy_friction = _params.friction;
                    _changes.friction = _params.friction;
                }
                if (variable_struct_exists(_params, "restitution")) {
                    phy_restitution = _params.restitution;
                    _changes.restitution = _params.restitution;
                }
                if (variable_struct_exists(_params, "linear_damping")) {
                    phy_linear_damping = _params.linear_damping;
                    _changes.linear_damping = _params.linear_damping;
                }
                if (variable_struct_exists(_params, "angular_damping")) {
                    phy_angular_damping = _params.angular_damping;
                    _changes.angular_damping = _params.angular_damping;
                }
            }
        } catch (_ex) {
            return { __error: "Failed to set physics properties. Is physics enabled on this instance? " + string(_ex), __code: -32602 };
        }

        return {
            instance_id: _inst,
            changes: _changes,
            success: true
        };
    });

    mcp_route("get_fixtures", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _result = {
            instance_id: _inst
        };

        try {
            with (_inst) {
                _result.density = phy_density;
                _result.friction = phy_friction;
                _result.restitution = phy_restitution;
                _result.linear_damping = phy_linear_damping;
                _result.angular_damping = phy_angular_damping;
                _result.linear_velocity_x = phy_linear_velocity_x;
                _result.linear_velocity_y = phy_linear_velocity_y;
                _result.angular_velocity = phy_angular_velocity;
                _result.mass = phy_mass;
                _result.is_sensor = phy_is_sensor;
                _result.is_kinematic = phy_is_kinematic;
            }
        } catch (_ex) {
            return { __error: "Failed to read fixture info. Is physics enabled on this instance? " + string(_ex), __code: -32602 };
        }

        _result.note = "GameMaker does not expose full fixture shape data at runtime. Showing available physics properties.";
        return _result;
    });

    mcp_route("raycast", function(_params) {
        if (!variable_struct_exists(_params, "x1") || !variable_struct_exists(_params, "y1")
            || !variable_struct_exists(_params, "x2") || !variable_struct_exists(_params, "y2")) {
            return { __error: "Missing required parameters: x1, y1, x2, y2", __code: -32602 };
        }

        var _hits = [];

        try {
            var _ray_result = physics_raycast(_params.x1, _params.y1, _params.x2, _params.y2, all);

            if (is_array(_ray_result)) {
                for (var _i = 0; _i < array_length(_ray_result); _i++) {
                    var _hit = _ray_result[_i];
                    array_push(_hits, {
                        instance_id: _hit.instance,
                        hit_x: _hit.x,
                        hit_y: _hit.y,
                        normal_x: _hit.normalX,
                        normal_y: _hit.normalY,
                        fraction: _hit.fraction
                    });
                }
            }
        } catch (_ex) {
            return { __error: "Raycast failed. Requires GameMaker 2024+ with physics enabled. " + string(_ex), __code: -32602 };
        }

        return {
            x1: _params.x1,
            y1: _params.y1,
            x2: _params.x2,
            y2: _params.y2,
            hits: _hits,
            hit_count: array_length(_hits)
        };
    });
}
