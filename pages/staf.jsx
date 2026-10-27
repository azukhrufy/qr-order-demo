import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Wrap,
  useToast
} from "@chakra-ui/react";
import { FiAlertTriangle, FiBell, FiCheck, FiFileText, FiRefreshCw, FiVolume2, FiVolumeX } from "react-icons/fi";
import { useLive, rupiah, postJSON } from "@/lib/client";

const NEXT_STATUS = {
  diterima: { next: "diproses", label: "Mulai diproses" },
  diproses: { next: "siap", label: "Siap diantar" },
  siap: { next: "disajikan", label: "Sudah disajikan" }
};

const STATUS_STYLE = {
  menunggu: { color: "brand.400", borderColor: "brand.600" },
  diterima: { color: "#5b9bd5", borderColor: "#2f4c6b" },
  diproses: { color: "#c9a0ff", borderColor: "#4a3670" },
  siap: { color: "success.400", borderColor: "#2c5b40" },
  disajikan: { color: "staff.500", borderColor: "staff.600" },
  ditolak: { color: "danger.400", borderColor: "#6b2f29" }
};

function timeAgo(ts, now) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  return `${Math.floor(s / 60)} mnt lalu`;
}

export default function StafPage() {
  const [menu, setMenu] = useState(null);
  const live = useLive();
  const [tabIndex, setTabIndex] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const audioCtxRef = useRef(null);
  const seenOrdersRef = useRef(new Set());
  const firstLoadRef = useRef(true);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((res) => res.json())
      .then(setMenu)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Bunyi baru boleh setelah staf berinteraksi (kebijakan autoplay browser).
  useEffect(() => {
    if (!audioReady) return;

    function beep() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      [0, 0.18].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = idx ? 1180 : 880;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + offset;
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    }

    const fresh = live.orders.filter(
      (o) => o.status === "menunggu" && !seenOrdersRef.current.has(o.id)
    );
    live.orders.forEach((o) => seenOrdersRef.current.add(o.id));

    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
    if (fresh.length) beep();
  }, [live.orders, audioReady]);

  function unlockAudio() {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    audioCtxRef.current.resume();
    setAudioReady(true);
  }

  const pending = live.orders.filter((o) => o.status === "menunggu").length;
  const calls = live.calls.filter((c) => !c.done);
  const items = menu?.items ?? [];

  const visibleOrders = useMemo(
    () => live.orders.filter((o) => o.status !== "ditolak").slice(0, 20),
    [live.orders]
  );

  async function setStatus(id, status) {
    await postJSON("/api/order/status", { id, status });
  }

  async function toggleSoldout(id, value) {
    await postJSON("/api/soldout", { id, value });
    toast({
      title: value ? "Ditandai habis" : "Tersedia lagi",
      status: value ? "warning" : "success",
      duration: 1600,
      position: "bottom-right"
    });
  }

  async function closeCall(id) {
    await postJSON("/api/call/done", { id });
  }

  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    seenOrdersRef.current = new Set();
    firstLoadRef.current = true;
  }

  if (!menu) {
    return (
      <Flex minH="100vh" bg="staff.900" align="center" justify="center">
        <Text color="staff.500">Memuat…</Text>
      </Flex>
    );
  }

  return (
    <>
      <Head>
        <title>Layar Staf — QR Order Demo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <Box minH="100vh" bg="staff.900" color="ink.50" pb={8}>
        <Flex
          position="sticky"
          top={0}
          zIndex={20}
          bg="staff.900"
          borderBottomWidth="1px"
          borderColor="staff.600"
          px={4}
          py={3}
          gap={2.5}
          align="center"
          wrap="wrap"
        >
          <Box>
            <Text fontWeight={700} fontSize="sm">
              Layar Staf
            </Text>
            <Text fontSize="2xs" color="staff.500" letterSpacing="wider" textTransform="uppercase">
              demo · pesanan &amp; ketersediaan
            </Text>
          </Box>

          <Badge
            ml="auto"
            px={3}
            py={1.5}
            borderRadius="full"
            bg={pending ? "#3a1f1c" : "staff.700"}
            color={pending ? "#ffb4ad" : "ink.50"}
            borderWidth="1px"
            borderColor={pending ? "#6b2f29" : "staff.600"}
            textTransform="none"
            fontSize="xs"
          >
            {pending} menunggu
          </Badge>

          <Button
            size="sm"
            onClick={unlockAudio}
            leftIcon={audioReady ? <FiVolume2 /> : <FiVolumeX />}
            bg={audioReady ? "success.500" : "staff.700"}
            color={audioReady ? "#0c1a12" : "ink.50"}
            borderWidth="1px"
            borderColor={audioReady ? "success.500" : "staff.600"}
            _hover={{ bg: audioReady ? "success.400" : "staff.600" }}
          >
            {audioReady ? "Suara aktif" : "Aktifkan suara"}
          </Button>

          <Button
            size="sm"
            onClick={reset}
            leftIcon={<FiRefreshCw />}
            bg="staff.700"
            color="ink.50"
            borderWidth="1px"
            borderColor="staff.600"
            _hover={{ bg: "staff.600" }}
          >
            Reset
          </Button>
        </Flex>

        <Tabs index={tabIndex} onChange={setTabIndex} variant="unstyled" px={4} pt={3}>
          <TabList gap={2}>
            {["Pesanan", "Ketersediaan menu"].map((label) => (
              <Tab
                key={label}
                px={4}
                py={2}
                borderRadius="full"
                borderWidth="1px"
                borderColor={tabIndex === (label === "Pesanan" ? 0 : 1) ? "brand.400" : "staff.600"}
                bg={tabIndex === (label === "Pesanan" ? 0 : 1) ? "brand.400" : "staff.800"}
                color={tabIndex === (label === "Pesanan" ? 0 : 1) ? "surface.900" : "staff.500"}
                fontSize="sm"
                fontWeight={650}
              >
                {label}
              </Tab>
            ))}
          </TabList>

          <TabPanels>
            <TabPanel px={0} pt={4}>
              <Stack spacing={2.5}>
                {calls.map((c) => (
                  <Flex
                    key={c.id}
                    bg="#2a2113"
                    borderWidth="1px"
                    borderColor="#5a4420"
                    borderRadius="13px"
                    p={3}
                    gap={2}
                    align="center"
                    wrap="wrap"
                  >
                    <HStack spacing={2}>
                      <Icon as={c.type === "bill" ? FiFileText : FiBell} color="brand.400" />
                      <Text fontSize="sm">
                        {c.type === "bill" ? "Minta bill" : "Panggil pelayan"} —{" "}
                        <Text as="b" color="brand.400">
                          Meja {c.table}
                        </Text>
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="staff.500">
                      {timeAgo(c.createdAt, now)}
                    </Text>
                    <Button
                      size="xs"
                      ml="auto"
                      onClick={() => closeCall(c.id)}
                      bg="success.500"
                      color="#0c1a12"
                      _hover={{ bg: "success.400" }}
                    >
                      Sudah direspons
                    </Button>
                  </Flex>
                ))}

                {!visibleOrders.length && !calls.length ? (
                  <Box textAlign="center" py={10} color="staff.500">
                    <Text fontSize="sm">
                      Belum ada pesanan masuk.
                      <br />
                      Buka <b>/tamu</b> di HP lain, lalu kirim pesanan.
                    </Text>
                  </Box>
                ) : null}

                {visibleOrders.map((o) => {
                  const late = o.status === "menunggu" && now - o.createdAt > 120000;
                  const style = STATUS_STYLE[o.status] || STATUS_STYLE.disajikan;
                  const step = NEXT_STATUS[o.status];

                  return (
                    <Box
                      key={o.id}
                      bg="staff.800"
                      borderWidth="1px"
                      borderColor={late ? "#6b2f29" : "staff.600"}
                      borderRadius="15px"
                      p={3}
                    >
                      <Flex align="center" gap={2} wrap="wrap">
                        <Badge bg="brand.400" color="surface.900" borderRadius="8px" px={2} textTransform="none">
                          Meja {o.table}
                        </Badge>
                        <Text fontSize="xs" color="staff.500">
                          {timeAgo(o.createdAt, now)}
                        </Text>
                        {late ? (
                          <HStack spacing={1}>
                            <Icon as={FiAlertTriangle} color="#ffb4ad" boxSize={3} />
                            <Text fontSize="xs" color="#ffb4ad">
                              belum diterima &gt;2 mnt
                            </Text>
                          </HStack>
                        ) : null}
                        <Badge
                          ml="auto"
                          bg="transparent"
                          color={style.color}
                          borderWidth="1px"
                          borderColor={style.borderColor}
                          borderRadius="full"
                          px={2}
                          fontSize="2xs"
                          letterSpacing="wider"
                        >
                          {o.status}
                        </Badge>
                      </Flex>

                      <Stack spacing={1} mt={2}>
                        {o.items.map((it, idx) => (
                          <HStack key={`${o.id}-${idx}`} spacing={2} align="flex-start">
                            <Text fontSize="sm" fontWeight={800} color="brand.400" minW="24px">
                              {it.qty}×
                            </Text>
                            <Text fontSize="sm">
                              {it.name}
                              {it.note ? (
                                <Text as="span" fontSize="xs" color="staff.500">
                                  {" "}
                                  ({it.note})
                                </Text>
                              ) : null}
                            </Text>
                          </HStack>
                        ))}
                      </Stack>

                      {o.note ? (
                        <Box mt={2} bg="staff.700" borderRadius="9px" px={2.5} py={2}>
                          <Text fontSize="xs" color="#ffd9a8">
                            📝 {o.note}
                          </Text>
                        </Box>
                      ) : null}

                      <Text fontSize="xs" color="staff.500" mt={2}>
                        Total {rupiah(o.total)}
                      </Text>

                      <Wrap mt={2.5} spacing={2}>
                        {o.status === "menunggu" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setStatus(o.id, "diterima")}
                              bg="success.500"
                              color="#0c1a12"
                              _hover={{ bg: "success.400" }}
                            >
                              Terima &amp; kirim ke dapur
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setStatus(o.id, "ditolak")}
                              bg="#3a1f1c"
                              color="#ffb4ad"
                              borderWidth="1px"
                              borderColor="#6b2f29"
                              _hover={{ bg: "#4a2723" }}
                            >
                              Tolak
                            </Button>
                          </>
                        ) : null}
                        {step ? (
                          <Button
                            size="sm"
                            onClick={() => setStatus(o.id, step.next)}
                            bg="brand.400"
                            color="surface.900"
                            _hover={{ bg: "brand.300" }}
                          >
                            {step.label}
                          </Button>
                        ) : null}
                      </Wrap>
                    </Box>
                  );
                })}
              </Stack>
            </TabPanel>

            <TabPanel px={0} pt={4}>
              <Stack spacing={2.5}>
                <Box bg="staff.800" borderWidth="1px" borderColor="staff.600" borderStyle="dashed" borderRadius="11px" px={3} py={2.5}>
                  <Text fontSize="xs" color="staff.500">
                    Tap <b>Habis</b> — item langsung hilang dari menu tamu dalam hitungan detik. Tamu yang
                    sudah memasukkannya ke keranjang akan ditolak saat mengirim pesanan.
                  </Text>
                </Box>

                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={2}>
                  {items.map((it) => {
                    const off = live.soldout.includes(it.id);
                    return (
                      <Box
                        key={it.id}
                        bg={off ? "#221716" : "staff.800"}
                        borderWidth="1px"
                        borderColor={off ? "#6b2f29" : "staff.600"}
                        borderRadius="12px"
                        p={2.5}
                      >
                        <Text fontSize="sm" fontWeight={650} color={off ? "#ffb4ad" : "ink.50"}>
                          {it.emoji} {it.name}
                        </Text>
                        <Text fontSize="xs" color="staff.500" mb={2}>
                          {rupiah(it.price)} · {it.cat}
                        </Text>
                        <Button
                          size="sm"
                          w="100%"
                          onClick={() => toggleSoldout(it.id, !off)}
                          bg={off ? "success.500" : "#3a1f1c"}
                          color={off ? "#0c1a12" : "#ffb4ad"}
                          borderWidth="1px"
                          borderColor={off ? "success.500" : "#6b2f29"}
                          _hover={{ bg: off ? "success.400" : "#4a2723" }}
                        >
                          {off ? "Tersedia lagi" : "Habis"}
                        </Button>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </>
  );
}
