const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

class MyApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // Crear el área de dibujo
        this.drawingArea = new St.DrawingArea();
        this.drawingArea.width = 50; // Ancho fijo para que sea visible en el panel
        this.drawingArea.height = panel_height; // Ajuste de altura para ocupar el panel
        this.drawingArea.connect("repaint", Lang.bind(this, this._onRepaint));
        this.actor.add(this.drawingArea);

        // Iniciar el bucle de actualización
        this._update();
    }

    _update() {
        this.memoryData = this._getMemoryUsage();
        this.drawingArea.queue_repaint();
        Mainloop.timeout_add_seconds(5, Lang.bind(this, this._update));
    }

    _getMemoryUsage() {
        let usage = {};
        let [ok, out, err] = GLib.spawn_command_line_sync("sh -c 'ps aux'");
        if (!ok) return usage;

        let lines = out.toString().split("\n");
        lines.forEach(line => {
            let parts = line.trim().split(/\s+/);
            if (parts.length > 5) {
                let command = parts[10];
                let memoryKb = parseFloat(parts[5]) || 0;
                let name = command.split("/").pop();
                if (usage[name]) {
                    usage[name] += memoryKb;
                } else {
                    usage[name] = memoryKb;
                }
            }
        });

        // Filtrar y sumar procesos importantes
        let filteredUsage = {};
        const targetProcesses = ["code", "brave", "obs"];
        for (let process in usage) {
            let memoryKb = usage[process];
            if (targetProcesses.includes(process) || memoryKb > 1024 * 1024) { // 1 GB threshold
                filteredUsage[process] = (filteredUsage[process] || 0) + memoryKb;
            }
        }
        return filteredUsage;
    }

    _onRepaint(area) {
        const width = this.drawingArea.width;
        const height = this.drawingArea.height;
        const ctx = area.get_context();

        // Fondo transparente
        ctx.setSourceRGBA(0, 0, 0, 0);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();

        const totalMemory = 16 * 1024 * 1024; // 16 GB en KB
        const colors = {
            "code": [0, 0, 1, 1],   // Azul
            "brave": [1, 0.5, 0, 1], // Naranja
            "obs": [0, 1, 0, 1]      // Verde
        };

        let x = 0;
        const barWidth = width / Object.keys(this.memoryData).length;

        for (let process in this.memoryData) {
            let memoryKb = this.memoryData[process];
            let barHeight = (memoryKb / totalMemory) * height;
            let color = colors[process] || [0.5, 0.5, 0.5, 1]; // Gris si no se especifica el color

            ctx.setSourceRGBA(...color);
            ctx.rectangle(x, height - barHeight, barWidth, barHeight);
            ctx.fill();

            x += barWidth;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
