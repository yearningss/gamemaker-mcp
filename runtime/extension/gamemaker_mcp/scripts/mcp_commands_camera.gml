/// @description MCP Commands - Camera Control

function mcp_register_commands_camera() {

    mcp_route("get_camera_info", function(_params) {
        var _cam;
        if (variable_struct_exists(_params, "camera_id")) {
            _cam = _params.camera_id;
        } else {
            _cam = camera_get_active();
        }

        if (_cam < 0) {
            return { __error: "No active camera found", __code: -32602 };
        }

        return {
            camera_id: _cam,
            x: camera_get_view_x(_cam),
            y: camera_get_view_y(_cam),
            width: camera_get_view_width(_cam),
            height: camera_get_view_height(_cam),
            angle: camera_get_view_angle(_cam)
        };
    });

    mcp_route("set_camera_position", function(_params) {
        if (!variable_struct_exists(_params, "x") || !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: x, y", __code: -32602 };
        }

        var _cam;
        if (variable_struct_exists(_params, "camera_id")) {
            _cam = _params.camera_id;
        } else {
            _cam = camera_get_active();
        }

        if (_cam < 0) {
            return { __error: "No active camera found", __code: -32602 };
        }

        camera_set_view_pos(_cam, _params.x, _params.y);

        return {
            camera_id: _cam,
            x: _params.x,
            y: _params.y,
            success: true
        };
    });

    mcp_route("set_camera_size", function(_params) {
        if (!variable_struct_exists(_params, "width") || !variable_struct_exists(_params, "height")) {
            return { __error: "Missing required parameters: width, height", __code: -32602 };
        }

        var _cam;
        if (variable_struct_exists(_params, "camera_id")) {
            _cam = _params.camera_id;
        } else {
            _cam = camera_get_active();
        }

        if (_cam < 0) {
            return { __error: "No active camera found", __code: -32602 };
        }

        camera_set_view_size(_cam, _params.width, _params.height);

        return {
            camera_id: _cam,
            width: _params.width,
            height: _params.height,
            success: true
        };
    });

    mcp_route("camera_shake", function(_params) {
        var _intensity = variable_struct_exists(_params, "intensity") ? _params.intensity : 5;
        var _duration = variable_struct_exists(_params, "duration") ? _params.duration : 30;

        global.__mcp_camera_shake = {
            active: true,
            intensity: _intensity,
            duration: _duration,
            offset_x: 0,
            offset_y: 0
        };

        return {
            active: true,
            intensity: _intensity,
            duration: _duration,
            note: "Camera shake started. Ensure your Step event checks global.__mcp_camera_shake to apply the effect."
        };
    });

    mcp_route("follow_instance", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _cam;
        if (variable_struct_exists(_params, "camera_id")) {
            _cam = _params.camera_id;
        } else {
            _cam = camera_get_active();
        }

        if (_cam < 0) {
            return { __error: "No active camera found", __code: -32602 };
        }

        var _vw = camera_get_view_width(_cam);
        var _vh = camera_get_view_height(_cam);
        var _target_x = _inst.x - (_vw / 2);
        var _target_y = _inst.y - (_vh / 2);

        camera_set_view_pos(_cam, _target_x, _target_y);

        // Store follow target for continuous tracking
        global.__mcp_camera_follow = {
            active: true,
            camera_id: _cam,
            instance_id: _inst
        };

        return {
            camera_id: _cam,
            following: _inst,
            x: _target_x,
            y: _target_y,
            note: "Camera positioned on instance. For continuous following, check global.__mcp_camera_follow in your Step event."
        };
    });

    mcp_route("get_view_info", function(_params) {
        var _view_index = variable_struct_exists(_params, "view_index") ? _params.view_index : 0;

        if (_view_index < 0 || _view_index > 7) {
            return { __error: "View index must be between 0 and 7", __code: -32602 };
        }

        var _cam = view_camera[_view_index];

        var _result = {
            view_index: _view_index,
            view_enabled: view_enabled,
            view_visible: view_visible[_view_index],
            camera_id: _cam
        };

        if (_cam >= 0) {
            _result.camera_x = camera_get_view_x(_cam);
            _result.camera_y = camera_get_view_y(_cam);
            _result.camera_width = camera_get_view_width(_cam);
            _result.camera_height = camera_get_view_height(_cam);
            _result.camera_angle = camera_get_view_angle(_cam);
        }

        return _result;
    });
}
