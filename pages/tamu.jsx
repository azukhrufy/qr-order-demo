import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  Link,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { FiAlertTriangle, FiBell, FiChevronLeft, FiFileText, FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { useLive, rupiah, postJSON } from "@/lib/client";

export default function TamuPage() {
  const [menu, setMenu] = useState(null);
  const live = useLive();
  const soldout = useMemo(() => new Set(live.soldout), [live.soldout]);

  const [cart, setCart] = useState({});
  const [cat, setCat] = useState("Semua");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  // Nomor meja diambil dari QR (?meja=12); fallback ke default di lib/menu.js
  const table = router.query.meja ? String(router.query.meja) : menu?.table;

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((res) => res.json())
      .then(setMenu)
      .catch(() => {});
  }, []);

  // Item di keranjang yang lalu ditandai habis oleh staf → buang + beri tahu.
  useEffect(() => {
    if (!menu) return;
    const gone = Object.keys(cartRef.current).filter((id) => soldout.has(id));
    if (!gone.length) return;

    const names = gone.map((id) => menu.items.find((it) => it.id === id)?.name).filter(Boolean);
    setCart((prev) => {
      const next = { ...prev };
      gone.forEach((id) => delete next[id]);
      return next;
    });
    toast({
      title: "Menu baru habis",
      description: `${names.join(", ")} dihapus dari pesanan.`,
      status: "warning",
      duration: 4200,
      isClosable: true,
      position: "bottom"
    });
  }, [live.soldout, menu, soldout, toast]);

  const items = menu?.items ?? [];

  const total = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [id, qty]) => {
        const item = items.find((it) => it.id === id);
        return sum + (item ? item.price * qty : 0);
      }, 0),
    [cart, items]
  );

  const count = useMemo(() => Object.values(cart).reduce((sum, qty) => sum + qty, 0), [cart]);
  const order = orderId ? live.orders.find((o) => o.id === orderId) : null;

  function add(id) {
    if (soldout.has(id)) {
      toast({
        title: "Menu ini baru saja habis",
        status: "error",
        duration: 2600,
        position: "bottom",
        isClosable: true
      });
      return;
    }
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function dec(id) {
    setCart((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) - 1 };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  }

  async function submit() {
    const payload = Object.entries(cart).map(([id, qty]) => {
      const item = items.find((it) => it.id === id);
      return { id, name: item.name, qty, price: item.price };
    });
    if (!payload.length) {
      toast({ title: "Pesanan masih kosong", status: "info", duration: 2000, position: "bottom" });
      return;
    }

    setSending(true);
    const { ok, status, data } = await postJSON("/api/order", {
      table,
      items: payload,
      note
    });
    setSending(false);

    // 409 = item ditandai habis di antara waktu menu dibuka dan waktu submit.
    if (status === 409 && data?.items) {
      setCart((prev) => {
        const next = { ...prev };
        data.items.forEach((name) => {
          const item = items.find((it) => it.name === name);
          if (item) delete next[item.id];
        });
        return next;
      });
      toast({
        title: "Baru saja habis",
        description: `${data.items.join(", ")}. Silakan pilih menu lain.`,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom"
      });
      return;
    }

    if (!ok) {
      toast({ title: "Pesanan gagal dikirim", status: "error", duration: 3000, position: "bottom" });
      return;
    }

    setOrderId(data.id);
    setCart({});
    setNote("");
    onClose();
  }

  async function callWaiter(type) {
    await postJSON("/api/call", { table, type });
    toast({
      title: type === "bill" ? "Permintaan bill dikirim" : "Panggilan pelayan dikirim",
      description: "Staf akan menghampiri meja Anda.",
      status: "success",
      duration: 3000,
      position: "bottom",
      isClosable: true
    });
  }

  if (!menu) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Text color="ink.500">Memuat menu…</Text>
      </Flex>
    );
  }

  const cats = ["Semua", ...menu.categories];
  const query = search.trim().toLocaleLowerCase();
  const visible = items.filter((it) => {
    const matchesCategory = cat === "Semua" || it.cat === cat || it.tag === cat;
    const searchableText = [it.name, it.desc, it.cat, it.tag].filter(Boolean).join(" ").toLocaleLowerCase();
    return matchesCategory && (!query || searchableText.includes(query));
  });

  const statusStep = (() => {
    const s = order?.status;
    if (!s) return 0;
    if (s === "diproses") return 2;
    if (s === "siap" || s === "disajikan") return 3;
    return 1;
  })();

  const steps = ["Pesanan diterima", "Sedang disiapkan dapur", "Siap, segera diantar"];

  return (
    <>
      <Head>
        <title>{menu.resto} — Pesan dari meja</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <Box pb={count > 0 ? "144px" : "88px"}>
        <Flex
          position="sticky"
          top={0}
          zIndex={20}
          bg="surface.800"
          borderBottomWidth="1px"
          borderColor="surface.600"
          px={4}
          py={3}
          align="center"
          gap={3}
        >
          <Box>
            <Text fontWeight={700}>{menu.resto}</Text>
            <Text fontSize="2xs" color="ink.500" letterSpacing="wider" textTransform="uppercase">
              Pesan langsung dari meja
            </Text>
          </Box>
          <Box ml="auto" bg="surface.700" borderWidth="1px" borderColor="surface.600" borderRadius="full" px={3} py={1}>
            <Text fontSize="xs" fontWeight={700} color="brand.400">
              Meja {table}
            </Text>
          </Box>
        </Flex>

        <Box px={4} pt={3}>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari makanan atau minuman"
            aria-label="Cari menu"
            bg="surface.800"
            borderColor="surface.600"
            _placeholder={{ color: "ink.500" }}
            _focusVisible={{ borderColor: "brand.400", boxShadow: "0 0 0 1px var(--chakra-colors-brand-400)" }}
          />
        </Box>

        <Flex gap={2} overflowX="auto" px={4} py={3}>
          {cats.map((c) => (
            <Button
              key={c}
              size="sm"
              onClick={() => setCat(c)}
              bg={c === cat ? "brand.400" : "surface.800"}
              color={c === cat ? "surface.900" : "ink.500"}
              borderWidth="1px"
              borderColor={c === cat ? "brand.400" : "surface.600"}
              borderRadius="full"
              flexShrink={0}
              _hover={{ bg: c === cat ? "brand.300" : "surface.700" }}
            >
              {c}
            </Button>
          ))}
        </Flex>

        {visible.length === 0 ? (
          <Text px={4} py={8} textAlign="center" color="ink.500" fontSize="sm">
            Menu tidak ditemukan.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} px={4} pb={2}>
            {visible.map((it) => {
              const off = soldout.has(it.id);
              const quantity = cart[it.id] || 0;

              return (
                <Box
                  key={it.id}
                  bg="surface.800"
                  borderWidth="1px"
                  borderColor={off ? "#4a2f2b" : "surface.600"}
                  borderRadius="16px"
                  overflow="hidden"
                  display="flex"
                  flexDirection="column"
                  position="relative"
                >
                  <Box w="full" aspectRatio="4 / 3" position="relative" bg="surface.700" overflow="hidden">
                    <Box
                      as="img"
                      src={it.image}
                      alt={it.name}
                      loading="lazy"
                      decoding="async"
                      w="full"
                      h="full"
                      objectFit="cover"
                      filter={off ? "grayscale(1)" : "none"}
                      opacity={off ? 0.6 : 1}
                      transition="filter .25s ease, opacity .25s ease"
                    />
                    {off ? (
                      <Flex
                        position="absolute"
                        inset={0}
                        align="center"
                        justify="center"
                        bg="blackAlpha.500"
                        pointerEvents="none"
                      >
                        <HStack
                          bg="danger.500"
                          color="white"
                          px={2.5}
                          py={1}
                          borderRadius="6px"
                          spacing={1}
                          boxShadow="md"
                        >
                          <Icon as={FiAlertTriangle} boxSize={3.5} />
                          <Text fontSize="2xs" fontWeight={800} letterSpacing="wider">
                            HABIS
                          </Text>
                        </HStack>
                      </Flex>
                    ) : null}

                    {it.imageCredit ? (
                      <Link
                        href={it.imageSource}
                        isExternal
                        position="absolute"
                        left={2}
                        bottom={2}
                        maxW="calc(100% - 16px)"
                        px={1.5}
                        py={0.5}
                        bg="blackAlpha.800"
                        color="white"
                        borderRadius="4px"
                        fontSize="9px"
                        lineHeight="short"
                        noOfLines={1}
                        _hover={{ color: "white", textDecoration: "underline" }}
                      >
                        {it.imageCredit}
                      </Link>
                    ) : null}
                  </Box>

                  <Flex p={3} flex={1} flexDirection="column" align="stretch">
                    <Text fontSize="sm" fontWeight={700} lineHeight="short" noOfLines={2} minH="2.5em">
                      {it.name}
                    </Text>
                    <Text fontSize="xs" color="ink.500" lineHeight="short" noOfLines={2} minH="2.5em" mt={1}>
                      {it.desc}
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight={700}
                      color={off ? "ink.500" : "brand.400"}
                      textDecoration={off ? "line-through" : "none"}
                      mt={2}
                    >
                      {rupiah(it.price)}
                    </Text>

                    <Box mt="auto" pt={3}>
                      {off ? (
                        <Button
                          w="full"
                          size="sm"
                          isDisabled
                          leftIcon={<FiAlertTriangle />}
                          bg="surface.700"
                          color="ink.500"
                          borderWidth="1px"
                          borderColor="surface.600"
                          _disabled={{ opacity: 1, cursor: "not-allowed" }}
                          aria-label={`${it.name} sedang habis`}
                        >
                          Habis
                        </Button>
                      ) : quantity === 0 ? (
                        <Button
                          w="full"
                          size="sm"
                          leftIcon={<FiPlus />}
                          onClick={() => add(it.id)}
                          bg="brand.400"
                          color="surface.900"
                          _hover={{ bg: "brand.300" }}
                        >
                          Pesan
                        </Button>
                      ) : (
                        <HStack justify="space-between" spacing={2}>
                          <IconButton
                            aria-label={quantity === 1 ? `Hapus ${it.name}` : `Kurangi ${it.name}`}
                            icon={quantity === 1 ? <FiTrash2 /> : <FiMinus />}
                            onClick={() => dec(it.id)}
                            size="sm"
                            minW={9}
                            h={9}
                            bg="surface.700"
                            color={quantity === 1 ? "danger.400" : "ink.50"}
                            borderWidth="1px"
                            borderColor="surface.600"
                            _hover={{ bg: "surface.600" }}
                          />
                          <Text minW={6} textAlign="center" fontSize="sm" fontWeight={700} aria-live="polite">
                            {quantity}
                          </Text>
                          <IconButton
                            aria-label={`Tambah ${it.name}`}
                            icon={<FiPlus />}
                            onClick={() => add(it.id)}
                            size="sm"
                            minW={9}
                            h={9}
                            bg="surface.700"
                            color="ink.50"
                            borderWidth="1px"
                            borderColor="surface.600"
                            _hover={{ bg: "surface.600" }}
                          />
                        </HStack>
                      )}
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </Box>

      <VStack
        position="fixed"
        left={0}
        right={0}
        bottom={0}
        px={4}
        pt={3}
        pb={`calc(12px + env(safe-area-inset-bottom))`}
        spacing={2}
        bg="surface.900"
        borderTopWidth="1px"
        borderColor="surface.600"
        zIndex={35}
      >
        {count > 0 ? (
          <Flex w="full" gap={2.5}>
            <Button onClick={onOpen} bg="surface.700" color="ink.50" borderWidth="1px" borderColor="surface.600">
              {count} item
            </Button>
            <Button flex={1} onClick={onOpen} bg="brand.400" color="surface.900" _hover={{ bg: "brand.300" }}>
              Lihat pesanan · {rupiah(total)}
            </Button>
          </Flex>
        ) : null}
        <Flex w="full" gap={2}>
          <Button
            flex={1}
            minW={0}
            size="sm"
            fontSize="xs"
            leftIcon={<FiBell />}
            onClick={() => callWaiter("pelayan")}
            bg="surface.700"
            color="ink.50"
            borderWidth="1px"
            borderColor="surface.600"
            _hover={{ bg: "surface.600" }}
          >
            Panggil pelayan
          </Button>
          <Button
            flex={1}
            minW={0}
            size="sm"
            fontSize="xs"
            leftIcon={<FiFileText />}
            onClick={() => callWaiter("bill")}
            bg="surface.700"
            color="ink.50"
            borderWidth="1px"
            borderColor="surface.600"
            _hover={{ bg: "surface.600" }}
          >
            Minta bill
          </Button>
        </Flex>
      </VStack>

      <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} size="md">
        <DrawerOverlay />
        <DrawerContent bg="surface.800" borderTopRadius="20px" borderTopWidth="1px" borderColor="surface.600">
          <DrawerHeader fontSize="md">Pesanan meja {table}</DrawerHeader>
          <DrawerBody>
            {Object.entries(cart).length === 0 ? (
              <Text fontSize="sm" color="ink.500">
                Belum ada item.
              </Text>
            ) : (
              <Stack spacing={0}>
                {Object.entries(cart).map(([id, qty]) => {
                  const it = items.find((x) => x.id === id);
                  if (!it) return null;
                  return (
                    <Box key={id}>
                      <Flex py={2.5} align="center" gap={3}>
                        <Box>
                          <Text fontSize="sm" fontWeight={600}>
                            {it.name}
                          </Text>
                          <Text fontSize="xs" color="ink.500">
                            {rupiah(it.price)}
                          </Text>
                        </Box>
                        <HStack ml="auto" spacing={2}>
                          <IconButton
                            size="xs"
                            aria-label="Kurangi"
                            icon={<FiMinus />}
                            onClick={() => dec(id)}
                            bg="surface.700"
                            color="ink.50"
                          />
                          <Text fontSize="sm" fontWeight={700} minW="18px" textAlign="center">
                            {qty}
                          </Text>
                          <IconButton
                            size="xs"
                            aria-label="Tambah"
                            icon={<FiPlus />}
                            onClick={() => add(id)}
                            bg="surface.700"
                            color="ink.50"
                          />
                        </HStack>
                      </Flex>
                      <Divider borderColor="surface.600" />
                    </Box>
                  );
                })}
              </Stack>
            )}

            <Flex justify="space-between" fontWeight={700} py={3}>
              <Text>Total</Text>
              <Text>{rupiah(total)}</Text>
            </Flex>
            <Text fontSize="xs" color="ink.500" mb={2}>
              Belum termasuk pajak &amp; service. Pembayaran di kasir.
            </Text>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan untuk dapur (mis. tanpa sambal, es sedikit)"
              bg="surface.700"
              borderColor="surface.600"
              size="md"
            />
          </DrawerBody>
          <DrawerFooter gap={2}>
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>
            <Button flex={1} onClick={submit} isLoading={sending} bg="brand.400" color="surface.900" _hover={{ bg: "brand.300" }}>
              Kirim ke dapur
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {orderId ? (
        <Flex position="fixed" inset={0} bg="surface.900" zIndex={60} direction="column" p={6} gap={4}>
          <Flex
            w="64px"
            h="64px"
            mx="auto"
            mt={5}
            borderRadius="full"
            bg="#1e3325"
            color="success.400"
            align="center"
            justify="center"
            fontSize="30px"
          >
            ✓
          </Flex>
          <Text fontSize="lg" fontWeight={700} textAlign="center">
            {order?.status === "ditolak" ? "Pesanan ditolak staf" : "Pesanan terkirim!"}
          </Text>
          <Text fontSize="sm" color="ink.500" textAlign="center">
            Meja {table} · {rupiah(order?.total || 0)}
          </Text>

          <Stack spacing={0} mt={2}>
            {steps.map((label, idx) => (
              <HStack key={label} align="flex-start" py={2.5} spacing={3}>
                <Box
                  mt="3px"
                  w="14px"
                  h="14px"
                  borderRadius="full"
                  borderWidth="2px"
                  borderColor={statusStep >= idx + 1 ? "brand.400" : "surface.600"}
                  bg={statusStep >= idx + 1 ? "brand.400" : "transparent"}
                />
                <Text
                  fontSize="sm"
                  color={statusStep >= idx + 1 ? "ink.50" : "ink.500"}
                  fontWeight={statusStep >= idx + 1 ? 650 : 400}
                >
                  {label}
                </Text>
              </HStack>
            ))}
          </Stack>

          <Stack spacing={2.5} mt="auto">
            <Button
              leftIcon={<FiChevronLeft />}
              onClick={() => setOrderId(null)}
              bg="surface.700"
              color="ink.50"
              borderWidth="1px"
              borderColor="surface.600"
            >
              Tambah pesanan
            </Button>
            <Button leftIcon={<FiFileText />} onClick={() => callWaiter("bill")} bg="brand.400" color="surface.900">
              Minta bill di kasir
            </Button>
          </Stack>
        </Flex>
      ) : null}
    </>
  );
}
