const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

class MyApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        this.panelHeight = panelHeight;

        // Crear el área de dibujo
        this.drawingArea = new St.DrawingArea();
        this.drawingArea.set_width(100); // Ancho de 100 px para testeo inicial
        this.drawingArea.set_height(this.panelHeight);
        this.drawingArea.connect("repaint", Lang.bind(this, this.drawStaticBars));

        // Agregar el área de dibujo al applet
        this.actor = new St.BoxLayout();
        this.actor.add(this.drawingArea);

        // Actualización periódica de la gráfica
        Mainloop.timeout_add_seconds(5, Lang.bind(this, this.updateDrawing));
    }

    updateDrawing() {
        // Forzar el repintado de las barras
        this.drawingArea.queue_repaint();
        return true;
    }

    drawStaticBars() {
        // Obtener el contexto de dibujo
        const cr = this.drawingArea.get_context();

        // Dibuja una barra azul (Code)
        cr.setSourceRGB(0.2, 0.6, 0.8); // Color azul
        cr.rectangle(10, this.panelHeight - 30, 30, 30); // Rectángulo de altura prueba
        cr.fill();

        // Dibuja una barra naranja (Brave)
        cr.setSourceRGB(1.0, 0.5, 0.0); // Color naranja
        cr.rectangle(50, this.panelHeight - 50, 30, 50); // Rectángulo de altura prueba
        cr.fill();
    }
}

// Colocar la función main al final para inicializar el applet
function main(metadata, orientation, panelHeight, instance_id) {
    return new MyApplet(metadata, orientation, panelHeight, instance_id);
}
