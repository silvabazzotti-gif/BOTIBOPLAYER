const dnsConfig = require('../config/dns');

let pedidos = [];

module.exports = {
    adicionarPedido: (dados) => {
        // Mapeia todos os servidores DNS para criar a lista de URLs M3U
        const playlists = dnsConfig.servidores.map(dns => {
            return `${dns}/get.php?username=${dados.user}&password=${dados.pass}&type=m3u_plus&output=ts`;
        });

        // Remove pedido anterior do mesmo MAC para evitar duplicados na fila
        pedidos = pedidos.filter(p => p.mac !== dados.mac);
        
        const novoPedido = {
            mac: dados.mac,
            key: dados.key,
            user: dados.user,
            pass: dados.pass,
            playlists: playlists, // Lista com os 15 links
            indiceAtual: 0,       // Controle de qual DNS está sendo processado
            status: "pendente",
            mensagem: "Aguardando início...",
            total: playlists.length
        };
        
        pedidos.push(novoPedido);
        return novoPedido;
    },

    buscarPedido: (mac) => pedidos.find(p => p.mac === mac),

    getFilaCompleta: () => pedidos
};
