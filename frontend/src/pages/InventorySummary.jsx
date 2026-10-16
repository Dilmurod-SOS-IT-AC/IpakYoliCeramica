import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';

export default function InventorySummary() {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        apiRequest('/api/inventory/summary/')
            .then((data) => setSummary(data))
            .catch((err) => setError(err.message));
    }, []);

    if (error) {
        return <p>Ошибка загрузки: {error}</p>;
    }

    if (summary === null) {
        return <p>Загрузка данных...</p>;
    }

    return (
        <section>
            <h1>Сводка склада</h1>
            <pre>{JSON.stringify(summary, null, 2)}</pre>
        </section>
    );
}