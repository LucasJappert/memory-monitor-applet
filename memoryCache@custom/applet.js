const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const ByteArray = imports.byteArray;

class MyApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Crear el botón que captura el clic
        this.button = new St.Button({ reactive: true, can_focus: true, track_hover: true });
        this.button.connect("button-press-event", () => {
            global.log("MyApplet: Clic detectado en el botón del applet.");
            this.showMemoryDetailDialog();
        });

        // Etiqueta para mostrar el texto dentro del botón
        this.label = new St.Label({ text: "Memoria Cache: Cargando..." });
        this.button.set_child(this.label);
        this.actor.add_actor(this.button);

        // Ejecutar la primera actualización de memoria
        this.refreshMemoryCache();
    }

    // Función para actualizar la memoria en caché en el applet
    refreshMemoryCache() {
        let [result, stdout, stderr] = GLib.spawn_command_line_sync("sh -c 'ps aux | grep code | grep -v grep'");
        if (result && stdout) {
            let output = ByteArray.toString(stdout);
            let lines = output.trim().split("\n");

            let totalMemory = 0;
            lines.forEach(line => {
                let columns = line.split(/\s+/);
                let memoryUsageKb = parseInt(columns[5]);
                if (!isNaN(memoryUsageKb)) {
                    totalMemory += memoryUsageKb;
                }
            });

            let totalMemoryMb = totalMemory / 1024;
            this.label.set_text(`Memoria Cache: ${totalMemoryMb.toFixed(2)} MB`);
            this.currentMemoryUsage = totalMemoryMb;
        } else {
            this.label.set_text("Error al obtener memoria cache");
        }

        Mainloop.timeout_add_seconds(5, this.refreshMemoryCache.bind(this));
    }

    // Función para obtener datos de memoria para los procesos relevantes
    getMemoryUsage() {
        let processes = ["code", "brave", "obs"];
        let memoryData = {};
    
        // Ejecuta `ps aux` a través de `sh -c` para asegurar la ejecución correcta
        let [result, stdout, stderr] = GLib.spawn_command_line_sync("sh -c 'ps aux'");
        if (result && stdout) {
            let output = ByteArray.toString(stdout);
            let lines = output.trim().split("\n");
            
            global.log(`MyApplet: Total líneas de salida: ${lines.length}`);
    
            lines.forEach(line => {
                let columns = line.split(/\s+/);
                let memoryUsageKb = parseInt(columns[5]);
                let processName = columns.slice(10).join(" ");  // Toma todas las columnas a partir de la décima
    
                global.log(`MyApplet: Procesando línea - Proceso: ${processName}, Memoria: ${memoryUsageKb} KB`);
    
                if (!isNaN(memoryUsageKb)) {
                    let memoryUsageMb = memoryUsageKb / 1024;
    
                    // Agrupa por procesos de interés o memoria mayor a 1 GB
                    if (processes.some(proc => processName.includes(proc)) || memoryUsageMb > 1024) {
                        // Encuentra el proceso principal para agrupación
                        let mainProcess = processes.find(proc => processName.includes(proc)) || processName;
    
                        if (!memoryData[mainProcess]) {
                            memoryData[mainProcess] = {
                                name: mainProcess,
                                memory: 0
                            };
                        }
                        // Suma la memoria de los subprocesos al proceso principal
                        memoryData[mainProcess].memory += memoryUsageMb;
                        global.log(`MyApplet: Agrupando - Proceso: ${mainProcess}, Memoria acumulada: ${memoryData[mainProcess].memory.toFixed(2)} MB`);
                    }
                }
            });
        } else {
            global.logError("MyApplet: Error al ejecutar ps aux. " + (stderr ? ByteArray.toString(stderr) : ""));
        }
    
        // Convertimos el objeto `memoryData` a un arreglo y formateamos los valores de memoria
        let memoryDataArray = Object.values(memoryData).map(entry => ({
            name: entry.name,
            memory: entry.memory.toFixed(2) + " MB"
        }));
    
        global.log(`MyApplet: Datos de memoria agrupados obtenidos - ${JSON.stringify(memoryDataArray)}`);
        return memoryDataArray;
    }
    

    // Función para mostrar la ventana de diálogo con la tabla de memoria
    showMemoryDetailDialog() {
        global.log("MyApplet: Mostrando el diálogo de detalles de memoria.");

        // Obtener los datos de memoria de los procesos relevantes
        let memoryData = this.getMemoryUsage();

        // Crear la ventana modal
        let dialog = new ModalDialog.ModalDialog({ styleClass: "memory-dialog" });

        // Crear una tabla para mostrar los datos de memoria
        let table = new St.BoxLayout({ vertical: true, style_class: "memory-table" });

        // Encabezado de la tabla
        let header = new St.BoxLayout({ style_class: "table-header" });
        header.add_child(new St.Label({ text: "Proceso", x_align: St.Align.START, x_expand: true }));
        header.add_child(new St.Label({ text: "Memoria Usada", x_align: St.Align.END, x_expand: true }));
        table.add_child(header);

        // Agregar cada proceso y su memoria a la tabla
        memoryData.forEach(entry => {
            let row = new St.BoxLayout();
            row.add_child(new St.Label({ text: entry.name, x_align: St.Align.START, x_expand: true }));
            row.add_child(new St.Label({ text: entry.memory, x_align: St.Align.END, x_expand: true }));
            table.add_child(row);
        });

        // Añadir la tabla al diálogo
        dialog.contentLayout.add(table);

        // Botón de cierre
        dialog.setButtons([{ label: "Cerrar", action: () => dialog.close() }]);
        dialog.open();
    }
}

// Registro del applet
function main(metadata, orientation, panelHeight, instanceId) {
    global.log("MyApplet: Ejecutando la función main()");
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
