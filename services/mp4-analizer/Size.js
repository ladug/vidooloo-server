/**
 * Created by vladi on 06-May-17.
 */
class Size {
    constructor(w, h) {
        this.w = w || 0;
        this.h = h || 0;
    }

    toString = () => ("(" + this.w + ", " + this.h + ")");
    getHalfSize = () => (new Size(this.w >>> 1, this.h >>> 1));
    length = () => (this.w * this.h);
}
module.exports=Size;