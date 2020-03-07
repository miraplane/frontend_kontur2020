'use strict';

const maxWeight = 368;
let map = {};

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.lenToStart = 0;
        this.cost = 0;
        this.parent = undefined;
    }

    /**
     *
     * @param {Point} other
     * @return {boolean}
     */
    isEqual(other) {
        return other.x === this.x && other.y === this.y;
    }
}

class Port {
    constructor(x, y, id) {
        this.xy = new Point(x, y);
        this.id = id;
    }
}

class Customer extends Port {
    constructor(x, y, id) {
        super(x, y, id);
        this.prices = [];
        this.routToHome = [];
    }
}

class Home extends Port{
    constructor(x, y, id) {
        super(x, y, id);
        this.goods = [];
        this.routsToCustomers = [];
    }
}

/**
 *
 * @param stringMap
 * @return {Array}
 */
function parseMap(stringMap) {
    let my_map = [];
    for (let line of stringMap.split('\n')) {
        my_map.push(line.split(''));
    }

    return my_map;
}

function calculateManhattanDistance(end, start) {
    return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

function isWall(point) {
    return (map.map)[point.y][point.x] === '#';
}

function isAbroad(point) {
    return point.x > map.size - 1 || point.x < 0 || point.y > map.size - 1 || point.y < 0;
}

function findMinCost(array) {
    let index = 0;
    for (let i = 1; i < array.length; i++) {
        if (array[i].cost < array[index].cost) {
            index = i;
        }
    }

    return index
}

function collectPath(current) {
    let path = [];
    while (current) {
        path.push(current);
        current = current.parent;
    }

    return path.reverse();
}

function getCustomersPorts(gameState) {
    let customers = {};
    for (let port of gameState.ports) {
        if (!port.isHome) {
            customers[port.portId] = new Customer(port.x, port.y, port.portId);
        }
    }

    for (let prices of gameState.prices) {
        customers[prices.portId].prices = prices;
    }

    return customers;
}

function getHomePort(gameState) {
    let home = {};
    for (let port of gameState.ports) {
        if (port.isHome) {
            home =  new Home(port.x, port.y, port.portId);
            break;
        }
    }
    home.goods = gameState.goodsInPort;

    return home;
}

/**
 *
 * @param {Point} start
 * @param {Point} end
 */
function findRout(start, end) {
    let heuristic = calculateManhattanDistance.bind(this, end);
    let openList = [];
    let closedList = [];

    openList.push(start);
    start.lenToStart = 0;
    start.cost = heuristic(start);
    start.parent = undefined;

    while (openList.length !== 0) {
        let index = findMinCost(openList);
        let current = openList[index];

        if (current.isEqual(end)) {
            return collectPath(current);
        }

        openList.splice(index, 1);
        closedList.push(current);

        for (let vector of [{x: -1, y: 0}, {x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1}]) {
            let next = new Point(current.x + vector.x, current.y + vector.y);

            if (isAbroad(next) || closedList.some(item => item.isEqual(next)) || isWall(next)) {
                continue;
            }

            let new_cost = current.lenToStart + 1;
            if (!closedList.some(item => item.isEqual(next)) || new_cost < next.lenToStart) {
                next.parent = current;
                next.lenToStart = new_cost;
                next.cost = new_cost + heuristic(next);
                if (!openList.some(item => item.isEqual(next))) {
                    openList.push(next);
                }
            }
        }
    }
}

function findRoutesFromHomeToAll() {
    let routs = [];
    for (let id in map.customers) {
        if (! map.customers.hasOwnProperty(id)) {
            continue;
        }

        let customer = map.customers[id];
        let rout = findRout(map.home.xy, customer.xy);
        map.home.routsToCustomers.push(rout);
        customer.routToHome = rout.reverse();

        routs.push(rout);
    }

    return routs;
}

function findRoutesBetweenPorts() {

}

export function startGame(levelMap, gameState) {
    map.map = parseMap(levelMap);
    map.size = map.map.length;
    map.customers = getCustomersPorts(gameState);
    map.home = getHomePort(gameState);
    map.route = findRoutesFromHomeToAll();
    console.log(map.route);
}

export function getNextCommand(gameState) {
    return 'WAIT';
}
