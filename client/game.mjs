'use strict';

const maxWeight = 368;
let load = 0;

let goods;

let maxX = 0;
let maxY = 0;
let map = [];
let seller;
let customers = [];

export function startGame(levelMap, gameState) {
    goods = gameState.goodsInPort;

    for (let port of gameState.ports) {
        let portInfo;
        if (port.isHome) {
            seller = port;
            //seller.goodsInPort = gameState.goodsInPort;
            continue;
        } else {
            portInfo = port;
            portInfo.prices = [];
        }

        for (let price of gameState.prices) {
            if (price.portId === port.portId) {
                portInfo.prices.push(price);
            }
        }

        customers.push(portInfo);
    }

    for (let line of levelMap.split('\n')) {
        map.push(line.split(''));
    }

    maxY = map.length - 1;
    maxX = map[0].length - 1;

    let parent = [];
    for (let i = 0; i < map.length; i++) {
        parent.push([]);
        for (let j = 0; j < map[i].length; j++) {
            parent[i][j] = undefined;
        }
    }
    parent[seller.y][seller.x] = {};

    let queue = [];
    queue.push({ y: seller.y, x: seller.x });

    while (queue.length !== 0) {
        let current = queue.shift();
        for (let vector of [{y: -1, x: 0}, {y: 1, x: 0}, {y: 0, x: -1}, {y: 0, x: 1}]) {
            let newY = current.y + vector.y;
            let newX = current.x + vector.x;
            if (newX > maxX || newX < 0 || newY > maxY || newY < 0) {
                continue;
            }

            if (parent[newY][newX]) {
                continue;
            }

            switch (map[newY][newX]) {
                case '~':
                    queue.push({ y: newY, x: newX});
                    break;
                case 'O':
                    let last = current;
                    let path = [{ y: newY, x: newX}];
                    while (last.x && last.y) {
                        path.unshift(last);
                        last = parent[last.y][last.x];
                    }

                    for (let port of customers) {
                        if (port.x === newX && port.y === newY) {
                            port.path = path;
                        }
                    }
                    break;
                default:
                    break;

            }
            parent[newY][newX] = current;
        }
    }

    customers.sort(function(first, second) {
        if (first.path.length > second.path.length)
            return 1;
        if (first.path.length < second.path.length)
            return -1;
        return 0;
    })
}

function loadGoods(gameState) {

}

export function getNextCommand(gameState) {
    switch (map[gameState.ship.y][gameState.ship.x]) {
        case 'H':

    }
    return 'N';
}
