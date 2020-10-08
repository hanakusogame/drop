import tl = require("@akashic-extension/akashic-timeline");
import { MainScene } from "./MainScene";
declare function require(x: string): any;

// メインのゲーム画面
export class MainGame extends g.E {
	public reset: () => void;
	public finish: () => void;
	public setMode: (num: number) => void;

	constructor(scene: MainScene) {
		const timeline = new tl.Timeline(scene);
		super({ scene: scene, x: 0, y: 0, width: 640, height: 360 });

		const bg = new g.FilledRect({
			scene: scene,
			width: g.game.width,
			height: g.game.height,
			cssColor: "white",
			opacity: 0.5,
		});
		this.append(bg);

		const mapSize = 70;
		const mapW = 6; //行(番兵含む)
		const mapH = 7; //列

		const base = new g.Sprite({
			scene: scene,
			src: scene.assets.waku,
			width: mapSize * mapW,
			height: mapSize * mapH,
			x: 20,
			y: -80,
			touchable: true,
		});
		this.append(base);

		// マップ
		const maps: Map[][] = [];
		for (let y = 0; y < mapH; y++) {
			maps[y] = [];
			for (let x = 0; x < mapW; x++) {
				const map = new Map({
					scene: scene,
					width: mapSize - 2,
					height: mapSize - 2,
					x: mapSize * x,
					y: mapSize * y,
					cssColor: "#DDDDDD",
				});
				maps[y][x] = map;

				map.num = 0;
				if (y === 0 || x === 0 || y === mapH - 1 || x === mapW - 1) {
					map.num = -1;
				} else {
					base.append(map);
				}
			}
		}

		//赤線
		const line = new g.FilledRect({
			scene: scene,
			x: mapSize - 4,
			y: mapSize * 2,
			width: mapSize * 4 + 8,
			height: 2,
			cssColor: "red"
		});
		base.append(line);

		// 次のブロック配置用
		const nextMaps: Map[] = [];
		for (let i = 0; i < 3; i++) {
			const map = new Map({
				scene: scene,
				width: mapSize - 2,
				height: mapSize - 2,
				x: 450 + 100 * i,
				y: 150,
				cssColor: "#DDDDDD",
			});
			this.append(map);
			nextMaps.push(map);
		}

		// パネル
		const panels: Panel[] = [];
		for (let i = 0; i < mapW * mapH; i++) {
			const panel = new Panel(mapSize);
			panels[i] = panel;
		}

		//詰み判定
		const mate: () => boolean = () => {
			for (let x = 1; x < mapW - 1; x++) {
				if (maps[1][x].panel) {
					return true;
				}
			}
			return false;
		};

		//連鎖数
		let comboCnt = 0;

		//足す処理
		const plus: (arr: { x: number; y: number }[]) => void = (arr) => {
			const arrPlus: { x: number; y: number }[] = [];
			let isClear = false;
			let score = 0;
			let srcMap: Map = null;
			comboCnt++;

			//探索ルーチン
			const sub: (x: number, y: number, num: number) => number = (x, y, num) => {
				let cnt = 0;

				for (let i = 0; i < 4; i++) {
					const xx = x + dx[i];
					const yy = y + dy[i];
					const dstMap = maps[yy][xx];
					const panel = dstMap.panel;
					if (panel && panel.num === num && panel !== srcMap.panel) {
						panel.num = 0;
						cnt++;

						//足すブロックに移動
						timeline
							.create(panel)
							.moveTo(srcMap.panel.x, srcMap.panel.y, 100)
							.call(() => {
								panel.remove();
							});
						panels.unshift(panel);
						dstMap.panel = null;
						cnt += sub(xx, yy, num); //再帰
					}
				}

				return cnt;
			};

			arr.forEach((p) => {
				const x = p.x;
				const y = p.y;
				srcMap = maps[y][x];

				if (!srcMap.panel) return; //既に消えている場合がある

				const cnt = sub(x, y, srcMap.panel.num);

				const ans = Math.min(srcMap.panel.num + cnt, 7);

				//足されたブロックの処理
				if (cnt !== 0) {
					if (comboCnt > 1) {
						//コンボ数表示用のラベル生成
						const label = new g.Label({
							scene: scene,
							font: scene.numFontR,
							text: "" + comboCnt,
							fontSize: 32,
							x: srcMap.x + 20,
							y: srcMap.y,
						});
						base.append(label);

						timeline
							.create(label)
							.moveBy(0, -20, 500)
							.wait(200)
							.call(() => {
								label.destroy();
							});
					}

					if (ans === 7) {
						//7のときけす
						isClear = true;
						const map = srcMap;
						timeline
							.create(map.panel)
							.wait(100)
							.call(() => {
								map.panel.setNum(ans);
							})
							.wait(200)
							.rotateTo(360, 500)
							.call(() => {
								panels.unshift(map.panel);
								map.panel.remove();
								map.panel = null;
							});
						scene.playSound("se_item");
					} else {
						//7以外のときは足す
						const map = srcMap;
						map.panel.isPlus = true;
						arrPlus.push({ x, y });

						timeline
							.create(map.panel)
							.scaleTo(1.3, 1.3, 100)
							.call(() => {
								map.panel.setNum(ans);
							})
							.scaleTo(1.0, 1.0, 100);
						scene.playSound("se_move");
					}
					score += Math.pow(2, ans) * 20 * comboCnt;
				}
			});

			if (score !== 0) {
				scene.addScore(score);
			}

			//setColor();

			if (arrPlus.length !== 0 || isClear) {
				const num = isClear ? 1000 : 250;
				timeline
					.create(this)
					.wait(num)
					.call(() => {
						drop();
					});
			} else {
				if (!mate()) {
					//次のブロック
					isMove = false;
					next(true);
					scene.playSound("se_move");
				} else {
					//詰み処理
					for (let y = 1; y < mapH - 1; y++) {
						for (let x = 1; x < mapW - 1; x++) {
							const panel = maps[y][x].panel;
							if (panel) {
								timeline
									.create(panel)
									.wait(y * 200 + x * 20)
									.call(() => {
										panel.setNum(8);
									});
							}
						}
					}
					timeline
						.create(this)
						.wait(2000)
						.call(() => {
							this.reset();
						});
					scene.playSound("se_miss");
				}
			}
		};

		//落とす
		const drop: () => void = () => {
			// １つ落とす
			const arr: { x: number; y: number }[] = []; //足す判定をするパネル
			const sub: (x: number, y: number) => boolean = (x, y) => {
				const map = maps[y][x];
				for (; y < mapH - 1; y++) {
					if (maps[y + 1][x].panel || maps[y + 1][x].num === -1) break;
				}
				if (map !== maps[y][x]) {
					maps[y][x].panel = map.panel;
					map.panel = null;

					arr.push({ x, y });
					return true;
				}
				return false;
			};

			// 設置されているパネルを探す
			for (let y = mapH - 2; y >= 1; y--) {
				for (let x = 1; x <= mapW - 2; x++) {
					const map = maps[y][x];
					if (map.panel) {
						const flg = map.panel.isPlus;
						map.panel.isPlus = false;
						if (!sub(x, y) && flg) {
							arr.unshift({ x, y }); //プラスされたパネルが動いていなかった場合追加
						}
					}
				}
			}

			setColor();

			timeline
				.create(this)
				.wait(300)
				.call(() => {
					plus(arr);
				});
		};

		// クリックイベント
		const dx = [1, 0, -1, 0];
		const dy = [0, 1, 0, -1];
		let isMove = false;

		base.pointDown.add((e) => {
			if (!scene.isStart || isMove) return;
			const x = Math.floor(e.point.x / mapSize);
			if (x < 1 || x >= mapW - 1) return;
			nowPanel.x = x * mapSize;
			nowPanel.modified();
		});

		base.pointMove.add((e) => {
			if (!scene.isStart || isMove) return;
			const x = Math.floor((e.point.x + e.startDelta.x) / mapSize);
			if (x < 1 || x >= mapW - 1) return;
			nowPanel.x = x * mapSize;
			nowPanel.modified();
		});

		base.pointUp.add((e) => {
			if (!scene.isStart || isMove) return;

			const x = Math.floor((e.point.x + e.startDelta.x) / mapSize);
			if (x < 1 || x >= mapW - 1) return;
			nowPanel.x = x * mapSize;
			nowPanel.modified();
			isMove = true;

			//ブロック設置
			maps[1][x].panel = nowPanel;
			comboCnt = 0;
			nowPanel = null;
			drop();
		});

		//色を変える処理
		const setColor: () => void = () => {
			for (let y = 0; y < mapH; y++) {
				for (let x = 0; x < mapW; x++) {
					const map = maps[y][x];
					map.modified();

					if (map.panel) {
						timeline.create(map.panel).moveTo(map.x, map.y, 200);

						if (map.panel.num !== 0) {
							map.panel.setNum(map.panel.num);
						}
					}
				}
			}
		};

		// メインループ
		this.update.add(() => {
			return;
		});

		// 終了
		this.finish = () => {
			return;
		};

		//次のブロックをセット
		let nowPanel: Panel = null;
		const next: (isAnim: boolean) => void = (isAnim) => {
			// 落とすブロックとして取得
			nowPanel = nextMaps[0].panel;
			if (nowPanel) {
				base.append(nowPanel);
				nowPanel.x = maps[1][2].x + mapSize / 2;
				nowPanel.y = maps[1][2].y - 5;
				nowPanel.modified();
			}

			// ずらす
			for (let i = 0; i < 2; i++) {
				const panel = nextMaps[i + 1].panel;
				nextMaps[i].panel = panel;
				if (panel) {
					if (isAnim) {
						timeline.create(panel).moveTo(nextMaps[i].x, nextMaps[i].y, 200);
					} else {
						panel.moveTo(nextMaps[i].x, nextMaps[i].y);
					}
				}
			}

			//最後尾に追加
			const num = scene.random.get(1, 3);
			const panel = panels.pop();
			nextMaps[2].panel = panel;
			panel.x = nextMaps[2].x;
			panel.y = nextMaps[2].y;
			panel.angle = 0;

			panel.isPlus = true;
			panel.setNum(num);

			this.append(panel);

			//setColor();
		};

		// リセット
		this.reset = () => {
			for (let y = 1; y < mapH - 1; y++) {
				for (let x = 1; x < mapW - 1; x++) {
					const map = maps[y][x];
					if (map.panel) {
						panels.unshift(map.panel);
						map.panel.remove();
						map.panel = null;
						map.num = 0;
					}
				}
			}

			if (nowPanel) {
				panels.unshift(nowPanel);
				nowPanel.remove();
				nowPanel = null;
			}
			next(true);

			isMove = false;
			return;
		};

		//ネクストブロックを埋める
		for (let i = 0; i < 3; i++) {
			next(false);
		}
	}
}

// マップクラス
class Map extends g.FilledRect {
	public num = 0;
	public panel: Panel;
}

// パネルクラス
class Panel extends g.FrameSprite {
	public num = 0;
	public label: g.Label;
	public isPlus: boolean = false;
	public setNum: (num: number) => void;

	constructor(size: number) {
		super({
			scene: g.game.scene(),
			width: size,
			height: size,
			src: g.game.scene().assets.panel as g.ImageAsset,
			frames: [0, 1, 2, 3, 4, 5, 6, 7],
		});

		// const scene = this.scene as MainScene;

		// const label = new g.Label({
		// 	scene: scene,
		// 	font: scene.numFont,
		// 	fontSize: 28,
		// 	text: "",
		// 	y: 15,
		// });
		// this.label = label;
		// this.append(label);

		//const colors = ["white", "green", "yellow", "blue", "pink", "cyan", "magenta"];
		this.setNum = (num) => {
			this.num = num;
			this.frameNumber = num - 1;
			this.modified();

			//label.text = "" + Math.pow(2, num);
			//label.text = "" + num;
			//label.invalidate();
		};
	}
}
