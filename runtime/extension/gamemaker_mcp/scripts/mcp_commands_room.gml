/// @description MCP Commands - Room Management

function mcp_register_commands_room() {

    mcp_route("get_current_room", function(_params) {
        return {
            name: room_get_name(room),
            index: room,
            width: room_width,
            height: room_height,
            instance_count: instance_count
        };
    });

    mcp_route("get_room_info", function(_params) {
        if (!variable_struct_exists(_params, "room_name")) {
            return { __error: "Missing required parameter: room_name", __code: -32602 };
        }

        var _rm = asset_get_index(_params.room_name);
        if (_rm < 0) {
            return { __error: "Room not found: " + _params.room_name, __code: -32602 };
        }

        var _result = {
            name: room_get_name(_rm),
            index: _rm,
            is_current: (_rm == room)
        };

        // Full dimensional info is only available for the current room
        if (_rm == room) {
            _result.width = room_width;
            _result.height = room_height;
            _result.instance_count = instance_count;
        } else {
            _result.note = "Full dimensions only available for the current room";
        }

        return _result;
    });

    mcp_route("goto_room", function(_params) {
        if (!variable_struct_exists(_params, "room_name")) {
            return { __error: "Missing required parameter: room_name", __code: -32602 };
        }

        var _rm = asset_get_index(_params.room_name);
        if (_rm < 0) {
            return { __error: "Room not found: " + _params.room_name, __code: -32602 };
        }

        room_goto(_rm);
        return { success: true, room_name: _params.room_name, room_index: _rm };
    });

    mcp_route("restart_room", function(_params) {
        room_restart();
        return { success: true, room_name: room_get_name(room) };
    });

    mcp_route("get_room_instances", function(_params) {
        var _instances = [];
        with (all) {
            array_push(_instances, {
                id: id,
                object_name: object_get_name(object_index),
                x: x,
                y: y,
                sprite_index: sprite_index,
                visible: visible,
                depth: depth,
                layer: layer
            });
        }
        return {
            room_name: room_get_name(room),
            instances: _instances,
            count: array_length(_instances)
        };
    });

    mcp_route("get_room_list", function(_params) {
        var _rooms = [];
        for (var _i = 0; _i <= room_last; _i++) {
            var _name = room_get_name(_i);
            if (_name != "") {
                array_push(_rooms, {
                    index: _i,
                    name: _name
                });
            }
        }
        return { rooms: _rooms, count: array_length(_rooms) };
    });

    mcp_route("room_get_viewport", function(_params) {
        var _view_index = variable_struct_exists(_params, "view_index") ? _params.view_index : 0;

        if (_view_index < 0 || _view_index > 7) {
            return { __error: "view_index must be between 0 and 7", __code: -32602 };
        }

        var _cam = view_camera[_view_index];
        var _result = {
            view_index: _view_index,
            view_enabled: view_enabled,
            view_visible: view_visible[_view_index],
            xport: view_xport[_view_index],
            yport: view_yport[_view_index],
            wport: view_wport[_view_index],
            hport: view_hport[_view_index],
            camera: _cam
        };

        if (_cam >= 0) {
            _result.camera_x = camera_get_view_x(_cam);
            _result.camera_y = camera_get_view_y(_cam);
            _result.camera_width = camera_get_view_width(_cam);
            _result.camera_height = camera_get_view_height(_cam);
        }

        return _result;
    });

}
