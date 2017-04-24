import Kernel from '../Kernel';
import Utils from '../Utils';
import MathUtils from '../math/Utils';
import Vertice from '../math/Vertice';
import Vector from '../math/Vector';
import MeshVertice from '../geometries/MeshVertice';
import Triangle from '../geometries/Triangle';
import Mesh from '../geometries/Mesh';
import MeshColorGraphic from '../graphics/MeshColorGraphic';
import MeshColorMaterial from '../materials/MeshColorMaterial';
import GraphicGroup from '../GraphicGroup';
import { Drawable } from '../Definitions.d';
import Camera from '../Camera';
import Service from '../Service';
import Extent from '../Extent';

class RouteGraphic extends MeshColorGraphic {
    constructor(private lonlats: number[][], private pixelWidth: number, resolution: number, material: MeshColorMaterial) {
        super(null, material);
        this.updateGeometry(resolution);
    }

    updateGeometry(resolution: number) {
        const geometry = this._getRouteGeometryByLonlats(this.lonlats, resolution, this.pixelWidth);
        this.setGeometry(geometry);
    }

    private _getRouteGeometryByLonlats(lonlats: number[][], resolution: number, pixelWidth: number) {
        const mesh = new Mesh();

        //count
        const vertices: Vertice[] = lonlats.map((lonlat) => {
            return MathUtils.geographicToCartesianCoord(lonlat[0], lonlat[1]);
        });
        //count
        const start2EndVectors: Vector[] = [];
        for (let i = 0; i < vertices.length - 1; i++) {
            let startVertice = vertices[i];
            let endVertice = vertices[i + 1];
            const start2EndVector = Vector.verticeMinusVertice(endVertice, startVertice);
            start2EndVectors.push(start2EndVector);
        }
        start2EndVectors.push(start2EndVectors[start2EndVectors.length - 1]);

        let startIndex: number = 0;
        const meshVerticesList: MeshVertice[][] = [];
        for (let i = 0; i < vertices.length; i++) {
            let startVertice = vertices[i];
            let start2EndVector = start2EndVectors[i];
            let result = this._getRouteVertices(startIndex, startVertice, start2EndVector, resolution, pixelWidth);
            startIndex = result.startIndex;
            meshVerticesList.push([result.v1, result.v3]);
            mesh.vertices.push(result.v1, result.v3);
        }

        for (let i = 0; i < meshVerticesList.length - 1; i++) {
            let v1 = meshVerticesList[i][0];
            let v3 = meshVerticesList[i][1];
            let v0 = meshVerticesList[i + 1][0];
            let v2 = meshVerticesList[i + 1][1];
            let triangles = Mesh.buildPlane(v0, v1, v2, v3);
            mesh.triangles.push(...triangles);
        }
        return mesh;
    }

    private _getRouteVertices(startIndex: number, startVertice: Vertice, start2EndVector: Vector, resolution: number, pixelWidth: number) {
        // const lineMesh = this.getLineMesh([116, -40], [117, 40], 1);
        // const material = new MeshColorMaterial([0, 255, 0]);
        // const graphic = new MeshColorGraphic(lineMesh, material);
        /*对于一个面从外面向里面看的绘制顺序
		 * 0    end    2
		 *
		 * 1   start   3*/
        const origin2StartVector = Vector.fromVertice(startVertice);
        // const start2EndVector = Vector.verticeMinusVertice(endVertice, startVertice);
        const end2StartVector = start2EndVector.getOpposite();

        // const [resolution,bestLevel] = this.camera.calculateCurrentResolutionAndBestDisplayLevel();
        // const {
        //     resolutionX,
        //     bestDisplayLevelFloatX,
        //     resolutionY,
        //     bestDisplayLevelFloatY
        // } = this.camera.measureXYResolutionAndBestDisplayLevel();
        // const resolution = (resolutionX + resolutionY) / 2;
        const offset = resolution * pixelWidth / 2;

        const start2LeftBottomVector = origin2StartVector.cross(start2EndVector).setLength(offset);
        const p1 = Vector.verticePlusVector(startVertice, start2LeftBottomVector).getArray();
        const v1 = new MeshVertice({
            i: startIndex++,
            p: p1
        });

        const start2RightBottomVector = origin2StartVector.cross(end2StartVector).setLength(offset);
        const p3 = Vector.verticePlusVector(startVertice, start2RightBottomVector).getArray();
        const v3 = new MeshVertice({
            i: startIndex++,
            p: p3
        });

        //     const end2LeftTopVector = origin2EndVector.cross(start2EndVector).setLength(offset);
        //     const p0 = Vector.verticePlusVector(endVertice, end2LeftTopVector).getArray();
        //     const v0 = new MeshVertice({
        //         i: startIndex++,
        //         p: p0
        //     });

        //     const end2RightTopVector = origin2EndVector.cross(end2StartVector).setLength(offset);
        //     const p2 = Vector.verticePlusVector(endVertice, end2RightTopVector).getArray();
        //     const v2 = new MeshVertice({
        //         i: startIndex++,
        //         p: p2
        //     });

        return {
            startIndex: startIndex,
            v1: v1,
            v3: v3
        };
    }
}

type RouteType = 'driving' | 'bus' | 'walking';

export default class RouteLayer extends GraphicGroup<Drawable>{
    private pixelWidth: number = 5;
    private routeColor: number[] = [7, 215, 108];
    private route: any = null;

    private constructor(private camera: Camera, private key: string) {
        super();
        // this.test();
        Utils.subscribe('level-change', () => {
            if (this.children.length > 0) {
                const resolution = this._getResolution();
                this.children.forEach((graphic: Drawable) => {
                    if (graphic instanceof RouteGraphic) {
                        graphic.updateGeometry(resolution);
                    }
                });
            }
        });
    }

    test(pixelWidth: number = 5, segments: number = 100, rgb: number[] = [0, 1, 0]) {
        // this.clear();
        const startLonLat: number[] = [116, 40];//[116, -40];
        const endLonLat: number[] = [116, 25];// [116, 40];
        const resolution = this._getResolution();
        this._addRouteByLonlat(startLonLat, endLonLat, pixelWidth, segments, rgb, resolution);
    }

    private _addRouteByLonlat(startLonLat: number[], endLonLat: number[], pixelWidth: number, segments: number, rgb: number[], resolution: number) {
        const lonlats = this._getLonlatsBySegments(startLonLat, endLonLat, segments);
        return this._addRouteByLonlats(lonlats, pixelWidth, rgb, resolution);
    }

    private _addRouteByLonlats(lonlats: number[][], pixelWidth: number, rgb: number[], resolution: number) {
        if (lonlats.length >= 2) {
            const graphic = new RouteGraphic(lonlats, pixelWidth, resolution, new MeshColorMaterial(rgb));
            this.add(graphic);
            return graphic;
        }
        return null;
    }

    private _getResolution() {
        const {
            resolutionX,
            bestDisplayLevelFloatX,
            resolutionY,
            bestDisplayLevelFloatY
        } = this.camera.measureXYResolutionAndBestDisplayLevel();
        return (resolutionX + resolutionY) / 2;
    }

    private _getLonlatsBySegments(startLonLat: number[], endLonLat: number[], segments: number) {
        const deltaLon: number = (endLonLat[0] - startLonLat[0]) / segments;
        const deltaLat: number = (endLonLat[1] - startLonLat[1]) / segments;
        const lonlats: number[][] = [];
        for (let i = 0; i < segments; i++) {
            let lonlat: number[] = [startLonLat[0] + deltaLon * i, startLonLat[1] + deltaLat * i];
            lonlats.push(lonlat);
        }
        lonlats.push(endLonLat);
        return lonlats;
    }

    showPath(pathIndex: number) {
        if (this.route) {
            if (this.route.type === 'driving') {
                this._showDrivingPath(pathIndex);
            } else if (this.route.type === 'bus') {
                this._showBusPath(pathIndex);
            }
        }
    }

    routeByDriving(fromLon: number, fromLat: number, toLon: number, toLat: number, strategy: number = 5) {
        return Service.routeByDriving(fromLon, fromLat, toLon, toLat, this.key, strategy).then((response: any) => {
            this._clearAll();
            if (response.route && response.route.paths && response.route.paths.length > 0) {
                this.route = response.route;
                this.showPath(0);
            }
            return response;
        });
    }

    private _showDrivingPath(pathIndex: number) {
        if (this.route && this.route.paths && this.route.paths.length > 0) {
            const path: any = this.route.paths[pathIndex];
            if (path && path.steps && path.steps.length > 0) {
                this.clear();
                const lonlats: number[][] = [];
                const resolution = this._getResolution();
                path.steps.forEach((step: any, index: number, steps: any[]) => {
                    if (index !== 0) {
                        let prevStep = steps[index - 1];
                        const joinLonlats: number[][] = [prevStep.lastLonlat, step.firstLonlat];
                        this._addRouteByLonlats(joinLonlats, this.pixelWidth, this.routeColor, resolution);
                        lonlats.push(...joinLonlats);
                    }
                    this._addRouteByLonlats(step.lonlats, this.pixelWidth, this.routeColor, resolution);
                    lonlats.push(...step.lonlats);
                });
                // this.addRouteByLonlats(lonlats, this.pixelWidth, color);
                const extent = Extent.fromLonlats(lonlats);
                this.camera.setExtent(extent);
            }
        }
    }

    routeByBus(fromLon: number, fromLat: number, toLon: number, toLat: number, startCity: string, endCity: string, strategy: number = 0) {
        return Service.routeByBus(fromLon, fromLat, toLon, toLat, startCity, endCity, this.key, strategy).then((response: any) => {
            this._clearAll();
            if (response.route && response.route.transits && response.route.transits.length > 0) {
                this.route = response.route;
                this.showPath(0);
            }
            return response;
        });
    }

    private _showBusPath(pathIndex: number) {
        if (this.route && this.route.transits && this.route.transits.length > 0) {
            const transit = this.route.transits[pathIndex];
            if (transit && transit.segments && transit.segments.length > 0) {
                this.clear();
                const lonlats: number[][] = [];
                const resolution = this._getResolution();
                transit.segments.forEach((segment: any) => {
                    if (segment.walking && segment.walking.lonlats && segment.walking.lonlats.length > 0) {
                        this._addRouteByLonlats(segment.walking.lonlats, this.pixelWidth, this.routeColor, resolution);
                        lonlats.push(...segment.walking.lonlats);
                    }
                    if (segment.bus && segment.bus.lonlats && segment.bus.lonlats.length > 0) {
                        this._addRouteByLonlats(segment.bus.lonlats, this.pixelWidth, [67, 140, 237], resolution);
                        lonlats.push(...segment.bus.lonlats);
                    }
                });
                const extent = Extent.fromLonlats(lonlats);
                this.camera.setExtent(extent);
            }
        }
    }

    private _clearAll() {
        this.route = null;
        this.clear();
    }

    protected onDraw(camera: Camera) {
        const gl = Kernel.gl;

        gl.disable(WebGLRenderingContext.DEPTH_TEST);
        gl.depthMask(false);

        super.onDraw(camera);

        gl.enable(WebGLRenderingContext.DEPTH_TEST);
        gl.depthMask(true);
    }

    destroy() {
        this.camera = null;
        super.destroy();
    }

    test2(str: string) {
        const splits = str.split(";");
        const splits1 = splits[0].split(",");
        const splits2 = splits[1].split(",");
        var lon1 = parseFloat(splits1[0]);
        var lat1 = parseFloat(splits1[1]);
        var lon2 = parseFloat(splits2[0]);
        var lat2 = parseFloat(splits2[1]);
        var s = Math.pow((lon1 - lon2), 2) + Math.pow((lat1 - lat2), 2);
        const distance = MathUtils.getRealArcDistanceBetweenLonLats(lon1, lat1, lon2, lat2);
        return {
            lon1: lon1,
            lat1: lat1,
            lon2: lon2,
            lat2: lat2,
            s: s,
            distance: distance
        };
    }

    static getInstance(camera: Camera, key: string) {
        return new RouteLayer(camera, key);
    }
};